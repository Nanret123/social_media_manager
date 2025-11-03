
export const ERROR_MESSAGES = {
  POST_NOT_FOUND: (postId: string) => `Post with ID ${postId} not found`,
  NO_PAGE_ACCOUNT: 'No page account found for scheduling',
  MISSING_ACCESS_TOKEN: 'Missing access token for platform',
  CONTAINER_CREATION_FAILED: 'Failed to create Instagram container',
  NATIVE_SCHEDULING_FAILED: 'Native scheduling failed',
  PUBLISH_FAILED: (platform: string) => `Failed to publish to ${platform}`,
  NO_PLATFORM_SERVICE: (platform: string) => `No platform service found for ${platform}`,
};

export const QUEUE_CONFIG = {
  CONCURRENCY: 3, // Number of concurrent jobs
  LOCK_DURATION: 30000, // 30 seconds job lock
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 60_000,
  BACKOFF_BASE: 2,
} as const;
