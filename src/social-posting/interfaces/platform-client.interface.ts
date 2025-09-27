import { Platform } from "@prisma/client";

export interface IPlatformClient {
  publishPost(accountId: string, post: PlatformPost): Promise<PostingResult>;
  uploadMedia(accountId: string, media: MediaUploadData): Promise<string>;
  validateCredentials(accountId: string): Promise<boolean>;
  getAccountInfo(accountId: string): Promise<PlatformAccountInfo>;
}

export interface PlatformAccountInfo {
  id: string;
  username: string;
  platform: Platform;
  metadata?: Record<string, any>;
}

export interface MediaUploadData {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  altText?: string;
}

export interface PlatformPost {
  content: string;
  mediaUrls: string[];
  options?: Record<string, any>;
}

export interface PostingResult {
  success: boolean;
  platformPostId?: string;
  url?: string;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// src/social-posting/interfaces/platform-client.interface.ts
// export interface PostingResult {
//   success: boolean;
//   platformPostId?: string;
//   url?: string;
//   message?: string;
//   error?: string;
//   metadata?: Record<string, any>;
// }

// export interface PlatformPost {
//   content: string;
//   mediaUrls?: string[];
//   options?: {
//     scheduleDate?: Date;
//     link?: string;
//     location?: string;
//     tags?: string[];
//   };
// }

// export interface IPlatformClient {
//   publishPost(accountId: string, post: PlatformPost): Promise<PostingResult>;
//  // uploadMedia(accountId: string, media: MediaItem): Promise<string>;
//   getAccountInfo(accountId: string): Promise<any>;
//   validateCredentials(accountId: string): Promise<boolean>;
// }

// export interface MediaItem {
//   buffer: Buffer;
//   filename: string;
//   mimeType: string;
//   altText?: string;
// }

// export interface SocialAccount {
//   id: string;
//   platform: Platform;
//   providerAccountId: string;
//   accessToken: string;
//   refreshToken?: string;
//   tokenExpiresAt?: Date;
//   username: string;
//   metadata: Record<string, any>;
// }