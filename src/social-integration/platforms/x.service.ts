import { Injectable, Logger } from '@nestjs/common';
import {
  PlatformService,
  PlatformUser,
} from '../interfaces/platform-service.interface';
import { TwitterApi } from 'twitter-api-v2';

@Injectable()
export class XService implements PlatformService {
  private readonly logger = new Logger(XService.name);
  private readonly twitterClient: TwitterApi;

  constructor() {
    this.twitterClient = new TwitterApi({
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET,
    });
  }

  getRequiredScopes(): string[] {
    return ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
  }

  getApiBaseUrl(): string {
    return 'https://api.x.com/2';
  }

  /**
   * Generate OAuth URL with automatic PKCE handling
   */
  async generateAuthUrl(redirectUri: string, state: string) {
    const { url, codeVerifier, state: generatedState } = 
      this.twitterClient.generateOAuth2AuthLink(redirectUri, {
        scope: this.getRequiredScopes(),
        state
      });

    return { url, codeVerifier, state: generatedState };
  }

  /**
   * Handle OAuth callback with automatic token exchange
   */
  async handleOAuthCallback(code: string, codeVerifier: string, redirectUri: string) {
    try {
      console.log(`code:${code}, codeVerifier: ${codeVerifier}, redirectUri: ${redirectUri}`)
      const response = await this.twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri,
      });
      console.log(response)
       const { 
        client: loggedClient, 
        accessToken, 
        refreshToken, 
        expiresIn 
      }  = response
      return {
        accessToken,
        refreshToken,
        expiresIn,
        client: loggedClient
      };
    } catch (error) {
      this.logger.error('X OAuth callback failed:', error);
      throw new Error(`X OAuth failed: ${error.message}`);
    }
  }

  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      const client = new TwitterApi(accessToken);
      const { data } = await client.v2.me();
      return !!data;
    } catch (error) {
      this.logger.error('Failed to validate X credentials:', error);
      return false;
    }
  }

  async getUserProfile(accessToken: string): Promise<PlatformUser> {
    try {
      const client = new TwitterApi(accessToken);
      const { data: userData } = await client.v2.me({
        'user.fields': ['username', 'name', 'profile_image_url']
      });

      return {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        profilePicture: userData.profile_image_url,
      };
    } catch (error) {
      this.logger.error('Failed to get X user profile:', error);
      throw new Error(`Could not retrieve user profile: ${error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.twitterClient.revokeOAuth2Token(accessToken);
    } catch (error) {
      this.logger.warn('X token revocation failed:', error);
      // Continue anyway since we're disconnecting the account
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    try {
      const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } = 
        await this.twitterClient.refreshOAuth2Token(refreshToken);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn
      };
    } catch (error) {
      this.logger.error('Failed to refresh X token:', error);
      throw new Error('Token refresh failed. Please reconnect your account.');
    }
  }
}
