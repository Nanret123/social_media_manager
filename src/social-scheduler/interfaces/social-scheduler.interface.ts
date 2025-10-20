import { Platform } from "@prisma/client";

export interface SocialPlatform {
  schedulePost(post: ScheduledPost): Promise<PublishingResult>;
  publishImmediately(post: ScheduledPost): Promise<PublishingResult>;
  deleteScheduledPost(postId: string, accessToken: string): Promise<boolean>;
  validateCredentials(accessToken: string): Promise<boolean>;
}

export interface ScheduledPost {
  id: string;
  content: string;
  mediaUrls: string[];
  scheduledAt: Date;
  metadata?: any;
}

export interface PublishingResult {
  success: boolean;
  platformPostId?: string;
  publishedAt?: Date;
  error?: string;
  metadata?: any;
}

export interface PlatformServiceMap {
  [key: string]: any; 
}


export interface PostMetadata {
  accessToken: string;
  pageId?: string;
  platformAccountId?: string;
  instagramBusinessId?: string;
  pageAccountId?: string;
}

export interface PublishingResult {
  success: boolean;
  platformPostId?: string;
  publishedAt?: Date;
  metadata?: any;
  error?: string;
}

export interface ScheduledJobData {
  postId: string;
  socialAccountId: string;
  platform: Platform;
  scheduledAt: Date;
  pageAccountId?: string;
  retryCount?: number;
}

export interface FacebookPostParams {
  message?: string;
  link?: string;
  scheduled_publish_time?: number;
  published?: boolean;
  access_token: string;
}

export interface InstagramPostParams {
  caption?: string;
  mediaType: 'IMAGE' | 'CAROUSEL' | 'VIDEO' | 'REEL';
  children?: string[];
  access_token: string;
}

export interface TwitterPostParams {
  text: string;
  media?: { media_ids: string[] };
}

export interface LinkedInPostParams {
  author: string;
  commentary: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  distribution?: {
    feedDistribution: 'MAIN_FEED' | 'NONE';
  };
}