import { Platform } from "@prisma/client";

// types/scheduler.types.ts
export interface ScheduleResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface CancelResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ProcessJobData {
  postId: string;
  retryCount?: number;
  containerId?: string;
  platform?: string;
  targetPlatform?: Platform;
  isRetry?: boolean;
}
