// src/social-integration/services/platforms/linkedin.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  PlatformService,
  PlatformUser,
} from '../interfaces/platform-service.interface';

@Injectable()
export class LinkedInService implements PlatformService {
  private readonly logger = new Logger(LinkedInService.name);
  private readonly apiBaseUrl = 'https://api.linkedin.com/v2';

  getRequiredScopes(): string[] {
    return ['w_member_social', 'r_liteprofile', 'r_organization_social'];
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.error('Failed to validate LinkedIn credentials:', error);
      return false;
    }
  }

  async getUserProfile(accessToken: string): Promise<PlatformUser> {
    try {
      // Get basic profile info
      const profileResponse = await fetch(
        `${this.apiBaseUrl}/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );

      if (!profileResponse.ok) {
        throw new Error(`LinkedIn API error: ${profileResponse.statusText}`);
      }

      const profileData = await profileResponse.json();

      // For organizations, we might want to get company page info instead
      const emailResponse = await fetch(
        `${this.apiBaseUrl}/emailAddress?q=members&projection=(elements*(handle~))`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );

      let username = '';
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        username = emailData.elements?.[0]?.['handle~']?.emailAddress || '';
      }

      return {
        id: profileData.id,
        username:
          username.split('@')[0] ||
          `${profileData.localizedFirstName}.${profileData.localizedLastName}`.toLowerCase(),
        name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
        profilePicture:
          profileData.profilePicture?.['displayImage~']?.elements?.[0]
            ?.identifiers?.[0]?.identifier,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn user profile:', error);
      throw new Error(`Could not retrieve user profile: ${error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await fetch('https://www.linkedin.com/oauth/v2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
      });
      this.logger.log('Successfully revoked LinkedIn token');
    } catch (error) {
      this.logger.warn('Failed to revoke LinkedIn token:', error);
    }
  }
}
