export interface PlatformUser {
  id: string;
  username: string;
  name: string;
  profilePicture: string | null;
  metadata?: {
    accountType?: 'instagram' | 'facebook';
    pageId?: string;
    pageName?: string;
    pageAccessToken?: string;
    instagramAccountId?: string;
    isPersonalAccount?: boolean;
  };
}

export interface OAuthState {
  organizationId: string;
  userId: string;
  redirectUri?: string;
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