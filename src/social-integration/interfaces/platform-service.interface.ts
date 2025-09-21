// src/social-integration/interfaces/platform-service.interface.ts
import { Platform } from '@prisma/client';

export interface PlatformUser {
  id: string;
  username: string;
  name: string;
  profilePicture?: string;
}

export interface PlatformService {
  /**
   * Validate access token credentials
   */
  validateCredentials(accessToken: string): Promise<boolean>;

  /**
   * Get user profile information
   */
  getUserProfile(accessToken: string): Promise<PlatformUser>;

  /**
   * Revoke access token (for disconnect)
   */
  revokeToken(accessToken: string): Promise<void>;

  /**
   * Get required OAuth scopes for this platform
   */
  getRequiredScopes(): string[];

  /**
   * Platform-specific API base URL
   */
  getApiBaseUrl(): string;
}