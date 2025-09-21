import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoService } from 'src/shared/encryption/crypto.service';
import { SocialAccountService } from 'src/social-account/social-account.service';
import { PlatformServiceFactory } from './platform-service.factory';

interface OAuthState {
  organizationId: string;
  userId: string;
  redirectUri?: string;
}

interface PlatformUser {
  id: string;
  username: string;
  name: string;
  profilePicture?: string;
}

@Injectable()
export class SocialIntegrationService {
  private readonly logger = new Logger(SocialIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly platformServiceFactory: PlatformServiceFactory,
    private readonly socialAccountService: SocialAccountService, // Inject SocialAccountService
  ) {}

  /**
   * Generate OAuth URL for a platform
   */
  async getAuthUrl(
    platform: Platform,
    organizationId: string,
    userId: string,
    redirectUri?: string,
  ): Promise<string> {
    // Check account limit before initiating OAuth
    const hasReachedLimit =
      await this.socialAccountService.hasReachedAccountLimit(organizationId);
    if (hasReachedLimit) {
      throw new Error('Organization has reached maximum social account limit');
    }

    // Create state token to prevent CSRF
    const state: OAuthState = { organizationId, userId, redirectUri };
    const encryptedState = this.cryptoService.encrypt(JSON.stringify(state));

    // Platform-specific OAuth configuration
    const authUrl = this.buildAuthUrl(platform, encryptedState);

    this.logger.log(
      `Generated OAuth URL for ${platform} for organization ${organizationId}`,
    );
    return authUrl;
  }

  /**
   * Handle OAuth callback and store credentials
   */
  async handleOAuthCallback(
    platform: Platform,
    code: string,
    encryptedState: string,
  ): Promise<{ success: boolean; account: any; redirectUri?: string }> {
    try {
      // Decrypt and verify state
      const decryptedState = this.cryptoService.decrypt(encryptedState);
      const stateData: OAuthState = JSON.parse(decryptedState);
      const { organizationId, userId } = stateData;

      // Exchange code for tokens (platform-specific)
      const tokens = await this.exchangeCodeForTokens(platform, code);

      // Get user profile to verify connection
      const platformService = this.platformServiceFactory.getService(platform);
      const userProfile = await platformService.getUserProfile(
        tokens.access_token,
      );

      // Store or update social account using SocialAccountService
      const socialAccount = await this.socialAccountService.upsertSocialAccount(
        {
          organizationId,
          platform,
          accountId: userProfile.id,
          username: userProfile.username,
          name: userProfile.name,
          profilePicture: userProfile.profilePicture,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokens.expires_at
            ? new Date(Date.now() + tokens.expires_at * 1000)
            : undefined,
          scopes: tokens.scope ? tokens.scope.split(',') : [],
        },
      );

      this.logger.log(
        `Successfully connected ${platform} account ${userProfile.username} to organization ${organizationId}`,
      );

      return {
        success: true,
        account: socialAccount,
        redirectUri: stateData.redirectUri,
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed for ${platform}:`, error);
      throw new Error(
        `Failed to connect ${platform} account: ${error.message}`,
      );
    }
  }

  /**
   * Get all connected accounts for an organization
   * Now delegates to SocialAccountService
   */
  async getConnectedAccounts(organizationId: string): Promise<any[]> {
    const accounts =
      await this.socialAccountService.findByOrganization(organizationId);

    return accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      accountId: account.platformAccountId,
      username: account.username,
      name: account.name,
      profilePicture: account.profileImage,
      tokenExpiresAt: account.tokenExpiresAt,
      scopes: account.scopes,
      createdAt: account.createdAt,
      needsReauth: account.tokenExpiresAt && account.tokenExpiresAt < new Date(),
    }));
  }

  /**
   * Disconnect a social account
   * Now delegates to SocialAccountService
   */
  async disconnectAccount(
    accountId: string,
    organizationId: string,
  ): Promise<void> {
    const account = await this.socialAccountService.findById(accountId);

    if (account.organizationId !== organizationId) {
      throw new NotFoundException('Social account not found');
    }

    // Optional: Revoke tokens on the platform side
    try {
      const platformService = this.platformServiceFactory.getService(
        account.platform,
      );
      await platformService.revokeToken(account.accessToken);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke token for ${account.platform}:`,
        error,
      );
    }

    // Use SocialAccountService for soft delete
    await this.socialAccountService.disconnect(accountId);

    this.logger.log(
      `Disconnected ${account.platform} account ${account.username} from organization ${organizationId}`,
    );
  }

  /**
   * Get a valid access token for an account (with automatic refresh)
   */
  async getValidAccessToken(accountId: string): Promise<string> {
    const account = await this.socialAccountService.findById(accountId);

    // Check if token needs refresh
    if (
      account.tokenExpiresAt &&
      account.tokenExpiresAt < new Date() &&
      account.refreshToken
    ) {
      this.logger.log(`Refreshing expired token for account ${accountId}`);
      return await this.refreshAccessToken(accountId);
    }

    // Return current valid token (already decrypted by SocialAccountService)
    return account.accessToken;
  }

  /**
   * Refresh an expired access token
   */
  private async refreshAccessToken(accountId: string): Promise<string> {
    const account = await this.socialAccountService.findById(accountId);

    if (!account.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const newTokens = await this.refreshTokens(
        account.platform,
        account.refreshToken,
      );

      // Update with new tokens using SocialAccountService
      await this.socialAccountService.update(accountId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        tokenExpiresAt: newTokens.expires_at
          ? new Date(Date.now() + newTokens.expires_at * 1000)
          : undefined,
      });

      this.logger.log(
        `Successfully refreshed token for ${account.platform} account ${account.username}`,
      );
      return newTokens.access_token;
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for account ${accountId}:`,
        error,
      );

      // Mark account as needing reauthentication using SocialAccountService
      await this.socialAccountService.disconnect(accountId);

      throw new Error('Token refresh failed. Please reconnect your account.');
    }
  }

  // --- Private Helper Methods ---

  private buildAuthUrl(platform: Platform, state: string): string {
    const baseUrls = {
      [Platform.INSTAGRAM]: 'https://www.facebook.com/v18.0/dialog/oauth',
      [Platform.FACEBOOK]: 'https://www.facebook.com/v18.0/dialog/oauth',
      [Platform.X]: 'https://twitter.com/i/oauth2/authorize',
      [Platform.LINKEDIN]: 'https://www.linkedin.com/oauth/v2/authorization',
    };

    const params = new URLSearchParams({
      client_id: this.getClientId(platform),
      redirect_uri: `${process.env.API_URL}/auth/${platform}/callback`,
      response_type: 'code',
      state: state,
      scope: this.getPlatformScopes(platform),
    });

    return `${baseUrls[platform]}?${params.toString()}`;
  }

  private getPlatformScopes(platform: Platform): string {
    const scopes = {
      [Platform.INSTAGRAM]:
        'instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement',
      [Platform.FACEBOOK]:
        'pages_manage_posts,pages_read_engagement,pages_manage_metadata',
      [Platform.X]: 'tweet.read,tweet.write,users.read,offline.access',
      [Platform.LINKEDIN]:
        'w_member_social,r_liteprofile,r_organization_social',
    };
    return scopes[platform];
  }

  private getClientId(platform: Platform): string {
    const envVars = {
      [Platform.INSTAGRAM]: process.env.META_CLIENT_ID,
      [Platform.FACEBOOK]: process.env.META_CLIENT_ID,
      [Platform.X]: process.env.X_CLIENT_ID,
      [Platform.LINKEDIN]: process.env.LINKEDIN_CLIENT_ID,
    };
    return envVars[platform];
  }

  private getClientSecret(platform: Platform): string {
    const envVars = {
      [Platform.INSTAGRAM]: process.env.META_CLIENT_SECRET,
      [Platform.FACEBOOK]: process.env.META_CLIENT_SECRET,
      [Platform.X]: process.env.X_CLIENT_SECRET,
      [Platform.LINKEDIN]: process.env.LINKEDIN_CLIENT_SECRET,
    };
    return envVars[platform];
  }

  private async exchangeCodeForTokens(
    platform: Platform,
    code: string,
  ): Promise<any> {
    const tokenUrl = this.getTokenUrl(platform);
    const clientId = this.getClientId(platform);
    const clientSecret = this.getClientSecret(platform);
    const redirectUri = `${process.env.API_URL}/auth/${platform}/callback`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Token exchange failed: ${errorData.error_description || response.statusText}`,
      );
    }

    return await response.json();
  }

  private getTokenUrl(platform: Platform): string {
    const urls = {
      [Platform.INSTAGRAM]:
        'https://graph.facebook.com/v18.0/oauth/access_token',
      [Platform.FACEBOOK]:
        'https://graph.facebook.com/v18.0/oauth/access_token',
      [Platform.X]: 'https://api.twitter.com/2/oauth2/token',
      [Platform.LINKEDIN]: 'https://www.linkedin.com/oauth/v2/accessToken',
    };
    return urls[platform];
  }

  private async refreshTokens(
    platform: Platform,
    refreshToken: string,
  ): Promise<any> {
    const tokenUrl = this.getTokenUrl(platform);
    const clientId = this.getClientId(platform);
    const clientSecret = this.getClientSecret(platform);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async validateCredentials(
    platform: Platform,
    accessToken: string,
  ): Promise<boolean> {
    const platformService = this.platformServiceFactory.getService(platform);
    return platformService.validateCredentials(accessToken);
  }

  async getUserProfile(
    platform: Platform,
    accessToken: string,
  ): Promise<PlatformUser> {
    const platformService = this.platformServiceFactory.getService(platform);
    return platformService.getUserProfile(accessToken);
  }
}
