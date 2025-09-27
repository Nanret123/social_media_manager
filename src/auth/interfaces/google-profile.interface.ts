// export interface GoogleProfile {
//   id: string;
//   email: string;
//   firstName: string;
//   lastName: string;
//   picture?: string;
// }

export interface OAuthProfile {
  id: string;           // Provider-specific user ID
  email: string;        // Email from provider
  firstName?: string;   // Optional
  lastName?: string;    // Optional
  avatar?: string;      // Profile picture URL
}