import { Platform } from "@prisma/client";


export interface RateLimitConfig {
  window: number; // in seconds
  limit: number;
}

// Example: platform → action → config
export const PLATFORM_RATE_LIMITS: Record<string, Record<string, RateLimitConfig>> = {
  twitter: {
    post: { window: 60, limit: 5 },   // 5 posts/minute
    like: { window: 60, limit: 20 },  // 20 likes/minute
  },
  facebook: {
    post: { window: 300, limit: 10 }, // 10 posts per 5 minutes
  },
  instagram: {
    post: { window: 600, limit: 15 }, // 15 posts per 10 minutes
  },
  general: {
    default: { window: 60, limit: 100 },
  },
};

// Map enum to key in PLATFORM_RATE_LIMITS
export const PLATFORM_KEY_MAP: Record<Platform, string> = {
  [Platform.X]: 'twitter',
  [Platform.FACEBOOK]: 'facebook',
  [Platform.INSTAGRAM]: 'instagram',
  [Platform.LINKEDIN]: 'linkedin'
};

//
