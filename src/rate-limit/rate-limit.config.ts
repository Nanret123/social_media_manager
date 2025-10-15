import { Platform } from "@prisma/client";


export interface RateLimitConfig {
  window: number; // in seconds
  limit: number;
}

// Example: platform → action → config
// src/rate-limiting/rate-limit.config.ts
export const PLATFORM_RATE_LIMITS = {
  // Social Platform Limits (per account)
  INSTAGRAM: {
    publish: { limit: 25, window: 3600 }, // 25 posts per hour
    read: { limit: 200, window: 3600 },   // 200 reads per hour
    media_upload: { limit: 50, window: 3600 },
  },
  FACEBOOK: {
    publish: { limit: 50, window: 3600 },
    read: { limit: 500, window: 3600 },
    media_upload: { limit: 100, window: 3600 },
  },
  LINKEDIN: {
    publish: { limit: 10, window: 3600 }, // LinkedIn has strict limits
    read: { limit: 100, window: 3600 },
  },
  X: {
    publish: { limit: 50, window: 3600 },
    read: { limit: 300, window: 900 },    // 300 reads per 15 minutes
  },

  // Internal Service Limits
  AI: {
    content_generation: { limit: 30, window: 60 },  // 30 requests per minute
    image_generation: { limit: 10, window: 60 },    // 10 images per minute
  },

  // API Endpoint Limits
  API: {
    post_creation: { limit: 10, window: 60 },       // 10 posts per minute
    bulk_operations: { limit: 3, window: 300 },     // 3 bulk ops per 5 minutes
    user_registration: { limit: 5, window: 3600 },  // 5 registrations per hour per IP
  },

  // General fallback
  GENERAL: {
    default: { limit: 100, window: 3600 },
  },
};

// Map enum to key in PLATFORM_RATE_LIMITS
export const PLATFORM_KEY_MAP: Record<Platform, string> = {
  [Platform.X]: 'twitter',
  [Platform.FACEBOOK]: 'facebook',
  [Platform.INSTAGRAM]: 'instagram',
  [Platform.LINKEDIN]: 'linkedin',
  [Platform.META]: 'meta',
  [Platform.AI]: 'ai',
  [Platform.API]: 'api',
  GENERAL: 'general',
};

//
