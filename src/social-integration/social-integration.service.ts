import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { SocialAccountService } from 'src/social-account/social-account.service';
import { PlatformServiceFactory } from './platform-service.factory';
import {
  OAuthState,
  PlatformUser,
} from './interfaces/platform-service.interface';
import { EncryptionService } from 'src/common/utility/encryption.service';
import axios from 'axios';
import { PKCEService } from 'src/common/utility/pkce-service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class SocialIntegrationService {
  private readonly logger = new Logger(SocialIntegrationService.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly platformServiceFactory: PlatformServiceFactory,
    private readonly socialAccountService: SocialAccountService,
    private readonly redisService: RedisService,
    private readonly pkceService: PKCEService,
  ) {}

  /**
   * Generate OAuth URL for a platform
   */
  async getAuthUrl(
    platform: Platform,
    organizationId: string,
    userId: string,
  ): Promise<string> {
    // Check account limit before initiating OAuth
    const hasReachedLimit =
      await this.socialAccountService.hasReachedAccountLimit(organizationId);
    if (hasReachedLimit) {
      throw new Error('Organization has reached maximum social account limit');
    }

    // Create state token to prevent CSRF
    const state: OAuthState = { organizationId, userId };
    const encryptedState = await this.encryptionService.encrypt(
      JSON.stringify(state),
    );
    console.log(encryptedState);
    // Platform-specific OAuth configuration
    const authUrl = await this.buildAuthUrl(platform, encryptedState);

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
      const decryptedState =
        await this.encryptionService.decrypt(encryptedState);
      const stateData: OAuthState = JSON.parse(decryptedState);
      const { organizationId, userId } = stateData;

      this.logger.log(`Processing OAuth callback for ${platform}`, {
        organizationId,
        userId,
      });

      let tokens;
      if (platform === Platform.X) {
        // Twitter requires PKCE, so pass state
        tokens = await this.exchangeCodeForTokens(
          platform,
          code,
          encryptedState,
        );
      } else {
        // Other platforms don’t need state for PKCE
        tokens = await this.exchangeCodeForTokens(platform, code);
      }

      // Get user profile to verify connection
      const platformService = this.platformServiceFactory.getService(platform);
      const userProfile = await platformService.getUserProfile(
        tokens.access_token,
      );
      console.log(userProfile);

      // ENCRYPT tokens before storing
      const encryptedAccessToken = await this.encryptionService.encrypt(
        tokens.access_token,
      );
      const encryptedRefreshToken = tokens.refresh_token
        ? await this.encryptionService.encrypt(tokens.refresh_token)
        : null;

      // Store metadata for Meta platforms
      const accountData: any = {
        organizationId,
        platform,
        platformAccountId: userProfile.id,
        username: userProfile.username,
        name: userProfile.name,
        profilePicture: userProfile.profilePicture,
        accessToken: encryptedAccessToken, // STORE ENCRYPTED
        refreshToken: encryptedRefreshToken, // STORE ENCRYPTED
        tokenExpiresAt: tokens.expires_at
          ? new Date(tokens.expires_at * 1000).toISOString()
          : undefined,
        scopes: tokens.scope ? tokens.scope.split(',') : [],
        metadata: userProfile.metadata,
      };

      // Store platform-specific metadata
      if (userProfile.metadata) {
        accountData.metadata = userProfile.metadata;
      }

      // Store or update social account using SocialAccountService
      const socialAccount =
        await this.socialAccountService.upsertSocialAccount(accountData);

      this.logger.log(
        `Successfully connected ${platform} account ${userProfile.username} to organization ${organizationId}`,
        { accountId: socialAccount.id },
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

  async getUserProfile(accountId: string): Promise<any> {
    // Fetch account from DB
    const account = await this.socialAccountService.findById(accountId);
    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    // Decrypt token
    const decryptedToken = await this.encryptionService.decrypt(
      account.accessToken,
    );

    // Call the platform-specific service
    const platformService = this.platformServiceFactory.getService(
      account.platform,
    );
    const profile = await platformService.getUserProfile(decryptedToken);

    this.logger.log(
      `Fetched profile for ${account.platform} account ${account.username}`,
    );

    return profile;
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
      needsReauth:
        account.tokenExpiresAt && account.tokenExpiresAt < new Date(),
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

    // DECRYPT the token before returning it
    try {
      return this.encryptionService.decrypt(account.accessToken);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt token for account ${accountId}:`,
        error,
      );
      throw new Error(
        'Token decryption failed. Please reconnect your account.',
      );
    }
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
      // DECRYPT refresh token first
      const decryptedRefreshToken = await this.encryptionService.decrypt(
        account.refreshToken,
      );

      const newTokens = await this.refreshTokens(
        account.platform,
        decryptedRefreshToken,
      );

      // ENCRYPT new tokens before storing
      const encryptedAccessToken = await this.encryptionService.encrypt(
        newTokens.access_token,
      );
      const encryptedRefreshToken = newTokens.refresh_token
        ? await this.encryptionService.encrypt(newTokens.refresh_token)
        : await this.encryptionService.encrypt(decryptedRefreshToken); // Keep old refresh token if new one not provided

      // Update with ENCRYPTED tokens
      await this.socialAccountService.update(accountId, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: newTokens.expires_at
          ? new Date(Date.now() + newTokens.expires_at * 1000).toISOString()
          : undefined,
      });

      this.logger.log(
        `Successfully refreshed and encrypted token for ${account.platform}`,
      );

      // Return DECRYPTED access token for immediate use
      return newTokens.access_token;
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for account ${accountId}:`,
        error,
      );

      // Mark account as needing reauthentication
      await this.socialAccountService.disconnect(accountId);
      throw new Error('Token refresh failed. Please reconnect your account.');
    }
  }

  // --- Private Helper Methods ---

  private async buildAuthUrl(
    platform: Platform,
    state: string,
  ): Promise<string> {
    const baseUrls = {
      [Platform.INSTAGRAM]: 'https://www.facebook.com/v18.0/dialog/oauth',
      [Platform.FACEBOOK]: 'https://www.facebook.com/v18.0/dialog/oauth',
      [Platform.X]: 'https://twitter.com/i/oauth2/authorize',
      [Platform.LINKEDIN]: 'https://www.linkedin.com/oauth/v2/authorization',
    };

    const params = new URLSearchParams({
      client_id: this.getClientId(platform),
      redirect_uri: this.getRedirectUri(platform),
      response_type: 'code',
      state: state,
      scope: this.getPlatformScopes(platform),
    });
    console.log(`state: ${state}`);

    // 🔹 Twitter requires PKCE
    if (platform === Platform.X) {
      const verifier = this.pkceService.generateVerifier();
      const challenge = this.pkceService.generateChallenge(verifier);
      console.log(`verifier: ${verifier}, challenge: ${challenge}`);

      // Store verifier temporarily (Redis, cache, or DB) with state
      await this.redisService.set(`twitter_pkce:${state}`, verifier, 300);

      params.append('code_challenge', challenge);
      params.append('code_challenge_method', 'S256');
    }

    // For Meta platforms, add additional parameters
    if (platform === Platform.INSTAGRAM || platform === Platform.FACEBOOK) {
      params.append('config_id', process.env.META_APP_CONFIG_ID || ''); // If using Business Login
    }

    const authUrl = `${baseUrls[platform]}?${params.toString()}`;
    this.logger.debug(`Built OAuth URL for ${platform}: ${authUrl}`);
    return authUrl;
  }

  private getPlatformScopes(platform: Platform): string {
    //     [Platform.INSTAGRAM]: [
    //   'instagram_basic',
    //   'instagram_content_publish', // Enables direct publishing
    //   'instagram_manage_messages',
    //   'pages_show_list',
    //   'pages_read_engagement',
    //   'business_management',
    // ].join(','),

    // [Platform.FACEBOOK]: [
    //   'pages_manage_posts',
    //   'pages_read_engagement',
    //   'pages_manage_metadata',
    //   'business_management',
    // ].join(',')

    // Same scopes for both Instagram and Facebook
    const metaScopes = [
      'business_management', // Manage business assets
      'pages_show_list', // See Facebook Pages
      'pages_read_engagement', // Read Page data
      'instagram_basic', // Read Instagram profile
      'instagram_content_publish', // Publish to Instagram
      'instagram_manage_messages', // Read/write Instagram DMs
      'pages_manage_posts', // Publish to Facebook Pages
      'pages_manage_metadata', // Manage Page settings
    ].join(',');

    const scopes = {
      [Platform.INSTAGRAM]: metaScopes,

      [Platform.FACEBOOK]: metaScopes,

      [Platform.X]: [
        'tweet.read',
        'tweet.write',
        'users.read',
        'offline.access', // For refresh tokens
      ].join(' '),

      [Platform.LINKEDIN]: [
        'w_member_social',
        'r_liteprofile',
        'r_organization_social',
      ].join(' '),
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

  private getRedirectUri(platform: Platform): string {
    return `${process.env.API_URL}/social/${platform}/callback`;
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
    state?: string,
  ): Promise<any> {
    const tokenUrl = this.getTokenUrl(platform);
    const clientId = this.getClientId(platform);
    const clientSecret = this.getClientSecret(platform);
    const redirectUri = this.getRedirectUri(platform);

    this.logger.debug(`Exchanging code for tokens for ${platform}`, {
      tokenUrl,
      redirectUri,
      clientId: clientId ? 'present' : 'missing', // Don't log actual client ID
    });

    // For Twitter: Use Basic Auth in headers, not client_secret in body
    const bodyParams = new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const headers: any = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    if (platform === Platform.X) {
      const verifier = await this.redisService.get(`twitter_pkce:${state}`);
      if (!verifier) throw new Error('Missing PKCE verifier for Twitter OAuth');

      bodyParams.append('code_verifier', verifier);

      // 🔥 Add Basic Auth header for Twitter
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      // For other platforms, keep client_id and client_secret in body
      bodyParams.append('client_id', clientId);
      bodyParams.append('client_secret', clientSecret);
    }

    try {
      console.log(bodyParams);
      const response = await axios.post(tokenUrl, bodyParams, {
      headers: headers, // ← THIS IS THE FIX!
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });

      this.logger.debug(
        `Token exchange response for ${platform}:`,
        response.data,
      );

      const tokenData = response.data;

      if (response.status >= 400) {
        this.logger.error(`Token exchange failed for ${platform}:`, tokenData);

        // Meta-specific error handling
        if (platform === Platform.INSTAGRAM || platform === Platform.FACEBOOK) {
          if (tokenData.error?.code === 190) {
            throw new Error('Session expired. Please reconnect your account.');
          }
          if (tokenData.error?.code === 100) {
            throw new Error(
              'Missing required permissions. Please grant all requested scopes.',
            );
          }
          if (tokenData.error?.code === 10) {
            throw new Error(
              'Application not authorized. Please check app permissions.',
            );
          }
        }

        throw new Error(
          `Token exchange failed: ${tokenData.error?.message || tokenData.error_description || response.statusText}`,
        );
      }

      // Normalize token response for Meta platforms
      if (platform === Platform.INSTAGRAM || platform === Platform.FACEBOOK) {
        return {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_in
            ? Math.floor(Date.now() / 1000) + tokenData.expires_in
            : undefined,
          scope: tokenData.scope || this.getPlatformScopes(platform),
          token_type: tokenData.token_type,
        };
      }

      return tokenData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(
            'Request timeout connecting to Facebook. Please try again.',
          );
        }
        if (error.code === 'ENETUNREACH' || error.code === 'ETIMEDOUT') {
          throw new Error(
            'Network error connecting to Facebook. Please check your internet connection and try again.',
          );
        }
      }
      throw error;
    }
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
}
