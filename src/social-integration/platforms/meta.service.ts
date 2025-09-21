// src/social-integration/services/platforms/meta.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PlatformService, PlatformUser } from '../interfaces/platform-service.interface';


@Injectable()
export class MetaService implements PlatformService {
  private readonly logger = new Logger(MetaService.name);
  private readonly apiBaseUrl = 'https://graph.facebook.com/v18.0';

  getRequiredScopes(): string[] {
    return [
      'instagram_basic',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_metadata'
    ];
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/me?access_token=${accessToken}`);
      return response.ok;
    } catch (error) {
      this.logger.error('Failed to validate Meta credentials:', error);
      return false;
    }
  }

  async getUserProfile(accessToken: string): Promise<PlatformUser> {
    try {
      // First, get the Facebook user ID
      const userResponse = await fetch(`${this.apiBaseUrl}/me?access_token=${accessToken}&fields=id,name`);
      
      if (!userResponse.ok) {
        throw new Error(`Facebook API error: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();

      // For Instagram Business accounts, we need to get the linked Instagram account
      const pagesResponse = await fetch(
        `${this.apiBaseUrl}/me/accounts?access_token=${accessToken}&fields=instagram_business_account{id,username,name,profile_picture_url}`
      );

      if (!pagesResponse.ok) {
        throw new Error(`Facebook Pages API error: ${pagesResponse.statusText}`);
      }

      const pagesData = await pagesResponse.json();

      // Find the first page with an Instagram business account
      const instagramAccount = pagesData.data.find((page: any) => page.instagram_business_account);

      if (instagramAccount?.instagram_business_account) {
        const igAccount = instagramAccount.instagram_business_account;
        return {
          id: igAccount.id,
          username: igAccount.username,
          name: igAccount.name,
          profilePicture: igAccount.profile_picture_url,
        };
      }

      // Fallback to Facebook user data if no Instagram account found
      return {
        id: userData.id,
        username: userData.name.toLowerCase().replace(/\s+/g, '.'),
        name: userData.name,
      };

    } catch (error) {
      this.logger.error('Failed to get Meta user profile:', error);
      throw new Error(`Could not retrieve user profile: ${error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await fetch(`${this.apiBaseUrl}/me/permissions?access_token=${accessToken}`, {
        method: 'DELETE',
      });
      this.logger.log('Successfully revoked Meta token');
    } catch (error) {
      this.logger.warn('Failed to revoke Meta token:', error);
      // Don't throw - revocation failure shouldn't break the disconnect flow
    }
  }
}