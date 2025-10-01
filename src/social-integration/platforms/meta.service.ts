import { Injectable, Logger } from '@nestjs/common';
import {
  PlatformService,
  PlatformUser,
} from '../interfaces/platform-service.interface';
import axios from 'axios';

@Injectable()
export class MetaService implements PlatformService {
  private readonly logger = new Logger(MetaService.name);
  private readonly apiBaseUrl = 'https://graph.facebook.com/v18.0';

  getRequiredScopes(): string[] {
    return [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'business_management',
    ];
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      // Use /me endpoint with proper error handling
      const response = await fetch(
        `${this.apiBaseUrl}/me?fields=id,name&access_token=${accessToken}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.warn(`Meta credentials validation failed:`, errorData);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate Meta credentials:', error);
      return false;
    }
  }

  async getUserProfile(accessToken: string): Promise<PlatformUser> {
    try {
      // Get user info with pages and Instagram accounts in one request
      const userResponse = await fetch(
        `${this.apiBaseUrl}/me?fields=id,name,accounts{id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}}&access_token=${accessToken}`,
      );

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(
          `Facebook API error: ${errorData.error?.message || userResponse.statusText}`,
        );
      }

      const userData = await userResponse.json();
      console.log(userData);
      this.logger.debug('Meta user data:', JSON.stringify(userData));

      // Check for Instagram Business accounts first
      if (userData.accounts?.data?.length > 0) {
        for (const page of userData.accounts.data) {
          if (page.instagram_business_account) {
            const igAccount = page.instagram_business_account;
            this.logger.log(
              `Found Instagram Business account: ${igAccount.username}`,
            );

            return {
              id: igAccount.id,
              username: igAccount.username,
              name: igAccount.name || igAccount.username,
              profilePicture: igAccount.profile_picture_url,
              metadata: {
                pageId: page.id,
                pageAccessToken: page.access_token,
                instagramAccountId: igAccount.id,
              },
            };
          }
        }

        // If we have pages but no Instagram, return the first page
        const firstPage = userData.accounts.data[0];
        this.logger.log(
          `No Instagram account found, using Facebook Page: ${firstPage.name}`,
        );

        return {
          id: firstPage.id,
          username: firstPage.name.toLowerCase().replace(/\s+/g, '.'),
          name: firstPage.name,
          profilePicture: null,
          metadata: {
            pageId: firstPage.id,
            pageAccessToken: firstPage.access_token,
          },
        };
      }

      // Fallback to personal Facebook profile
      this.logger.log(
        'No business accounts found, using personal Facebook profile',
      );
      return {
        id: userData.id,
        username: userData.name?.toLowerCase().replace(/\s+/g, '.'),
        name: userData.name,
        profilePicture: null,
        metadata: { isPersonalAccount: true },
      };
    } catch (error) {
      this.logger.error('Failed to get Meta user profile:', error);
      throw new Error(`Could not retrieve user profile: ${error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/me/permissions?access_token=${accessToken}`,
        { method: 'DELETE' },
      );

      if (response.ok) {
        this.logger.log('Successfully revoked Meta token permissions');
      } else {
        this.logger.warn('Failed to revoke Meta token permissions');
      }
    } catch (error) {
      this.logger.warn('Error revoking Meta token:', error);
    }
  }

}