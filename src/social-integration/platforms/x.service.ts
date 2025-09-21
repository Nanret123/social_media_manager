// src/social-integration/services/platforms/x.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PlatformService, PlatformUser } from '../interfaces/platform-service.interface';


@Injectable()
export class XService implements PlatformService {
  private readonly logger = new Logger(XService.name);
  private readonly apiBaseUrl = 'https://api.twitter.com/2';

  getRequiredScopes(): string[] {
    return [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access'
    ];
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.error('Failed to validate X credentials:', error);
      return false;
    }
  }

  async getUserProfile(accessToken: string): Promise<PlatformUser> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users/me?user.fields=username,name,profile_image_url`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`X API error: ${response.statusText}`);
      }

      const userData = await response.json();

      return {
        id: userData.data.id,
        username: userData.data.username,
        name: userData.data.name,
        profilePicture: userData.data.profile_image_url,
      };

    } catch (error) {
      this.logger.error('Failed to get X user profile:', error);
      throw new Error(`Could not retrieve user profile: ${error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    // X API v2 doesn't have a straightforward token revocation endpoint
    // In practice, you'd need to implement this using the OAuth 2.0 token revocation spec
    this.logger.log('X token revocation requires custom implementation');
    // For now, we just log since revocation isn't critical for disconnect
  }
}