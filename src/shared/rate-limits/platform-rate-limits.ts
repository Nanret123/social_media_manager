export interface PlatformRateLimit {
  postsPerWindow: number;
  windowMinutes: number;
  windowHours?: number;
  description: string;
}

export const PLATFORM_RATE_LIMITS: Record<string, PlatformRateLimit> = {
  instagram: {
    postsPerWindow: 25,
    windowHours: 1, // 25 posts per hour
    description: 'Instagram Business: 25 posts per hour'
  },
  facebook: {
    postsPerWindow: 50,
    windowHours: 1, // 50 posts per hour
    description: 'Facebook Pages: 50 posts per hour'
  },
  twitter: {
    postsPerWindow: 50,
    windowHours: 3, // 50 posts per 3 hours
    description: 'Twitter: 50 posts per 3 hours (approx)'
  },
  linkedin: {
    postsPerWindow: 25,
    windowHours: 1, // 25 posts per hour
    description: 'LinkedIn: 25 posts per hour'
  }
};

export const GLOBAL_RATE_LIMITS = {
  // Safety limits to prevent accidental spam
  MAX_POSTS_PER_DAY: 100,
  MIN_TIME_BETWEEN_POSTS: 30 * 1000, // 30 seconds between posts
};