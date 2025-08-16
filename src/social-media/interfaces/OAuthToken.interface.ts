interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}