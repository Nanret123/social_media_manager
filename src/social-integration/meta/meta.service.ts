import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  FacebookAdsApi,
  User,
  Page,
  InstagramUser,
} from 'facebook-nodejs-business-sdk';
import { EncryptionService } from 'src/common/utility/encryption.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OAuthState } from '../interfaces/platform-service.interface';
import { Platform } from '@prisma/client';
import { SocialAccountService } from 'src/social-account/social-account.service';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly graphApiBase = 'https://graph.facebook.com/v19.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly socialAccountService: SocialAccountService,
  ) {}

  /**
   * Initialize Meta SDK with access token
   */
  private initMetaAPI(accessToken: string): void {
    FacebookAdsApi.init(accessToken);
    // Set default API instance
    FacebookAdsApi.setDefaultApi(FacebookAdsApi.init(accessToken));
  }

  /**
   * Generate Business Login URL with proper scopes
   */
  async generateAuthUrl(
    organizationId: string,
    userId: string,
    redirectUri?: string,
  ) {
    // Create state token to prevent CSRF
    const state: OAuthState = {
      organizationId,
      userId,
      redirectUri,
      timestamp: Date.now(), // Add timestamp for expiration
    };

    const encryptedState = await this.encryptionService.encrypt(
      JSON.stringify(state),
    );

    const base = `https://www.facebook.com/v19.0/dialog/oauth`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.META_CLIENT_ID!,
      redirect_uri: this.getRedirectUri(),
      state: encryptedState,
      scope: [
        'email',
        'public_profile',
        'business_management',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'pages_manage_engagement',
        'pages_read_user_engagement',
        'publish_video',
        'pages_manage_metadata',
        'pages_read_user_content',
        'instagram_basic',
        'instagram_manage_messages',
        'instagram_content_publish',
      ].join(','),
    });

    return { url: `${base}?${params.toString()}`, state: encryptedState };
  }

  async handleOAuthCallback(
    code: string,
    encryptedState: string,
  ): Promise<{ success: boolean; accountId: string }> {
    const stateData = await this.decryptAndValidateState(encryptedState);
    const { organizationId, userId } = stateData;

    this.logger.log(`Processing OAuth callback for organization`, {
      organizationId,
      userId,
    });

    try {
      // Exchange code for user access token
      const tokenData = await this.exchangeCodeForToken(code);
      console.log('Token Data:', tokenData);

      // Debug token to get detailed information
      const debugToken = await this.debugToken(tokenData.access_token);
      console.log('Debug Token:', debugToken);
      // Get user profile
      const userProfile = await this.getUserProfile(tokenData.access_token);
      console.log('User Profile:', userProfile);

      // Get user pages with their access tokens
      const userPages = await this.getUserPages(tokenData.access_token);
      console.log('User Pages:', userPages);

      // Calculate token expiration
      const tokenExpiresAt = this.calculateTokenExpiration(
        tokenData,
        debugToken,
      );

      // Encrypt user access token
      const encryptedAccessToken = await this.encryptionService.encrypt(
        tokenData.access_token,
      );

      // Prepare social account data (main user account)
      const accountData = {
        organizationId,
        platform: Platform.META,
        platformAccountId: userProfile.id,
        username: userProfile.username || userProfile.name,
        name: userProfile.name,
        profileImage: userProfile.profilePicture,
        accessToken: encryptedAccessToken,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        scopes: debugToken.scopes || [],
        metadata: {
          email: userProfile.email,
          profilePicture: userProfile.profilePicture,
          tokenType: tokenData.token_type || 'bearer',
          dataAccessExpirationTime: debugToken.data_access_expires_at,
          grantedScopes: debugToken.scopes,
        },
      };

      // Store or update main social account
      const socialAccount =
        await this.socialAccountService.upsertSocialAccount(accountData);

      // Store pages in PageAccount model
      await this.syncUserPages(socialAccount.id, userPages);

      this.logger.log(
        `Successfully connected Meta account ${userProfile.name} with ${userPages.length} pages`,
        { accountId: socialAccount.id, organizationId },
      );

      return {
        success: true,
        accountId: socialAccount.id,
      };
    } catch (error) {
      this.logger.error('Meta OAuth callback failed', {
        error: error.message,
        stack: error.stack,
        organizationId,
      });
      throw new BadRequestException(`Meta OAuth failed: ${error.message}`);
    }
  }

  /**
   * Exchange code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    const tokenUrl = `${this.graphApiBase}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: process.env.META_CLIENT_ID!,
      client_secret: process.env.META_CLIENT_SECRET!,
      redirect_uri: this.getRedirectUri(),
      code,
    });

    const response = await fetch(`${tokenUrl}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      this.logger.error('Token exchange failed', data.error);
      throw new Error(
        data.error?.message || 'Failed to exchange code for token',
      );
    }

    return data;
  }

  /**
   * Get user pages with their access tokens
   */
  async getUserPages(userAccessToken: string): Promise<any[]> {
    try {
      this.initMetaAPI(userAccessToken);
      const me = new User('me');

      const accounts = await me.getAccounts([
        'id',
        'name',
        'access_token',
        'category',
        'instagram_business_account{id,username,name,profile_picture_url}',
        'link',
        'picture{url}',
        'tasks', // What the user can do on this page
      ]);

      return accounts.map((account) => ({
        id: account.id,
        name: account.name,
        access_token: account.access_token, // Page-specific access token
        category: account.category,
        instagram_business_account: account.instagram_business_account,
        link: account.link,
        picture: account.picture?.url,
        tasks: account.tasks,
        can_post: account.tasks?.includes('CREATE_CONTENT') || false,
      }));
    } catch (error) {
      this.logger.error('Error fetching Meta pages', { error: error.message });
      throw new BadRequestException('Could not fetch user pages');
    }
  }

  /**
   * Store or update all pages connected to a social account in PageAccount model
   */
  async syncUserPages(socialAccountId: string, pages: any[]): Promise<any[]> {
    try {
      const pageRecords = await Promise.all(
        pages.map(async (page) => {
          const encryptedToken = await this.encryptionService.encrypt(
            page.access_token,
          );

          const igAccount = page.instagram_business_account;

          return this.prisma.pageAccount.upsert({
            where: { platformPageId: page.id },
            update: {
              name: page.name,
              category: page.category,
              accessToken: encryptedToken,
              instagramBusinessId: igAccount?.id,
              instagramUsername: igAccount?.username,
              profilePicture: page.picture || null, // or custom fetch below
              metadata: {
                link: page.link,
                category: page.category,
                instagramData: igAccount,
                tasks: page.tasks,
                canPost: page.tasks?.includes('CREATE_CONTENT') || false,
                lastSynced: new Date(),
              },
              updatedAt: new Date(),
            },
            create: {
              platformPageId: page.id,
              name: page.name,
              category: page.category,
              accessToken: encryptedToken,
              instagramBusinessId: igAccount?.id,
              instagramUsername: igAccount?.username,
              profilePicture: page.picture || null,
              socialAccountId,
              metadata: {
                link: page.link,
                category: page.category,
                instagramData: igAccount,
                tasks: page.tasks,
                canPost: page.tasks?.includes('CREATE_CONTENT') || false,
                lastSynced: new Date(),
              },
            },
          });
        }),
      );

      this.logger.log(
        `Synced ${pageRecords.length} Facebook pages (and linked Instagram accounts if available) for social account ${socialAccountId}`,
      );
      return pageRecords;
    } catch (error) {
      this.logger.error('Failed to sync user pages', {
        message: error.message,
        stack: error.stack,
      });
      throw new BadRequestException('Could not sync Facebook/Instagram pages');
    }
  }

  /**
   * Get decrypted access token for API calls
   */
  async getDecryptedAccessToken(socialAccountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
      select: { accessToken: true },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return await this.encryptionService.decrypt(account.accessToken);
  }

  /**
   * Refresh token if expired (for future implementation)
   */
  async refreshTokenIfNeeded(socialAccountId: string): Promise<boolean> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
      select: { tokenExpiresAt: true, accessToken: true },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    // Check if token is expired or about to expire (within 24 hours)
    if (
      account.tokenExpiresAt &&
      new Date(account.tokenExpiresAt) <
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {
      // Implement token refresh logic here
      this.logger.warn(`Token for account ${socialAccountId} needs refresh`);
      return false;
    }

    return true;
  }

  /**
   * Decrypt and validate OAuth state with expiration
   */
  private async decryptAndValidateState(
    encryptedState: string,
  ): Promise<OAuthState> {
    try {
      const decryptedState =
        await this.encryptionService.decrypt(encryptedState);
      const stateData: OAuthState = JSON.parse(decryptedState);

      // Validate required fields
      if (!stateData.organizationId || !stateData.userId) {
        throw new Error('Invalid state data: missing required fields');
      }

      // Validate timestamp (prevent replay attacks, 10-minute expiration)
      if (
        !stateData.timestamp ||
        Date.now() - stateData.timestamp > 10 * 60 * 1000
      ) {
        throw new Error('OAuth state expired');
      }

      return stateData;
    } catch (error) {
      this.logger.error('Failed to decrypt OAuth state:', error);
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }
  /**
   * Debug token to get detailed information
   */
  private async debugToken(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.graphApiBase}/debug_token?input_token=${accessToken}&access_token=${this.getAppAccessToken()}`,
    );
    const data = await response.json();
    console.log('Debug Token Response:', data);

    if (!response.ok || data.error || !data.data?.is_valid) {
      throw new Error(data.error?.message || 'Invalid token');
    }

    return data.data;
  }

  /**
   * Get app access token for debug purposes
   */
  private getAppAccessToken(): string {
    return `${process.env.META_CLIENT_ID!}|${process.env.META_CLIENT_SECRET!}`;
  }

  /**
   * Verify user access token validity and get user info using SDK
   */
  async verifyUserAccessToken(userAccessToken: string): Promise<{
    userId: string;
    scopes: string[];
    expiresAt: Date | null;
    isValid: boolean;
  }> {
    try {
      this.initMetaAPI(userAccessToken);

      // Use SDK for token verification
      const debugToken = await this.debugToken(userAccessToken);

      return {
        userId: debugToken.user_id,
        scopes: debugToken.scopes || [],
        expiresAt: debugToken.expires_at
          ? new Date(debugToken.expires_at * 1000)
          : null,
        isValid: debugToken.is_valid,
      };
    } catch (error) {
      this.logger.error('Error verifying Meta token', error);
      throw new UnauthorizedException('Invalid or expired Facebook token');
    }
  }

  /**
   * Get user profile information using SDK
   */
  async getUserProfile(userAccessToken: string): Promise<{
    id: string;
    name: string;
    email?: string;
    username?: string;
    profilePicture?: string;
  }> {
    try {
      this.initMetaAPI(userAccessToken);
      const me = new User('me');

      const user = await me.get(['id', 'name', 'email', 'picture{url}']);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.picture?.url,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Meta user profile', error);
      throw new BadRequestException('Unable to fetch Facebook user profile');
    }
  }

  /**
   * Get all businesses the user manages using SDK
   */
  async getUserBusinesses(userAccessToken: string): Promise<any[]> {
    try {
      this.initMetaAPI(userAccessToken);
      const me = new User('me');

      const businesses = await me.getBusinesses([
        'id',
        'name',
        'vertical',
        'created_time',
      ]);

      return businesses.map((business) => ({
        id: business.id,
        name: business.name,
        vertical: business.vertical,
        createdTime: business.created_time,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch businesses', error);
      throw new BadRequestException('Unable to fetch Facebook businesses');
    }
  }

  /**
   * Get Instagram business account linked to a Facebook page using SDK
   */
  async getInstagramBusinessAccount(
    pageId: string,
    pageAccessToken: string,
  ): Promise<any> {
    try {
      this.initMetaAPI(pageAccessToken);
      const page = new Page(pageId);

      const instagramAccount = await page.get([
        'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}',
      ]);

      return instagramAccount.instagram_business_account || null;
    } catch (error) {
      this.logger.error(
        'Error fetching Instagram business account',
        error.message,
      );
      return null;
    }
  }

  /**
   * Get page insights using SDK
   */
  async getPageInsights(
    pageId: string,
    pageAccessToken: string,
    metrics: string[] = ['page_impressions'],
  ): Promise<any[]> {
    try {
      this.initMetaAPI(pageAccessToken);
      const page = new Page(pageId);

      const insights = await page.getInsights(metrics, {
        // Optional: Add date range or other parameters
      });

      return insights.map((insight) => ({
        name: insight.name,
        period: insight.period,
        values: insight.values,
        title: insight.title,
        description: insight.description,
      }));
    } catch (error) {
      this.logger.error('Error fetching page insights', error);
      throw new BadRequestException('Could not fetch page insights');
    }
  }

  /**
   * Publish to Instagram using SDK
   */
  async publishToInstagram(
    instagramAccountId: string,
    pageAccessToken: string,
    content: {
      imageUrl?: string;
      videoUrl?: string;
      caption?: string;
    },
  ): Promise<any> {
    try {
      this.initMetaAPI(pageAccessToken);
      const igAccount = new InstagramUser(instagramAccountId);

      let creationResult;

      if (content.imageUrl) {
        // Create container for image
        creationResult = await igAccount.createMedia(
          [InstagramUser.Fields.image_url, InstagramUser.Fields.caption],
          {
            image_url: content.imageUrl,
            caption: content.caption,
          },
        );
      } else if (content.videoUrl) {
        // Create container for video
        creationResult = await igAccount.createMedia(
          [
            InstagramUser.Fields.media_type,
            InstagramUser.Fields.video_url,
            InstagramUser.Fields.caption,
          ],
          {
            media_type: 'VIDEO',
            video_url: content.videoUrl,
            caption: content.caption,
          },
        );
      } else {
        throw new Error('Either imageUrl or videoUrl is required');
      }

      // Publish the container
      const publishResult = await igAccount.createMediaPublish(
        [InstagramUser.Fields.creation_id],
        {
          creation_id: creationResult.id,
        },
      );

      return publishResult;
    } catch (error) {
      this.logger.error('Error publishing to Instagram', error);
      throw new BadRequestException('Failed to publish to Instagram');
    }
  }

  /**
   * Revoke app permissions (disconnect) using HTTP call
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.graphApiBase}/me/permissions?access_token=${accessToken}`,
        { method: 'DELETE' },
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to revoke Meta token permissions');
      }

      this.logger.log('Meta token permissions revoked successfully');
    } catch (error) {
      this.logger.error('Error revoking Meta token', error);
      throw new BadRequestException('Failed to revoke token permissions');
    }
  }

  /**
   * Validate access token quickly using SDK
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      this.initMetaAPI(accessToken);
      const me = new User('me');

      // Simple call to validate token
      await me.get(['id']);
      return true;
    } catch (error) {
      this.logger.warn('Meta token validation failed', error);
      return false;
    }
  }

  private calculateTokenExpiration(
    tokens: any,
    debugToken?: any,
  ): Date | undefined {
    if (debugToken?.expires_at && debugToken.expires_at > 0) {
      return new Date(debugToken.expires_at * 1000);
    }

    if (tokens?.expires_in && tokens.expires_in > 0) {
      return new Date(Date.now() + tokens.expires_in * 1000);
    }

    if (debugToken?.data_access_expires_at) {
      // Use data access expiration as fallback (for long-lived tokens)
      return new Date(debugToken.data_access_expires_at * 1000);
    }

    return undefined; // token might not expire
  }

  private getRedirectUri(): string {
    return `${process.env.API_URL}/social/meta/auth/callback`;
  }
}
