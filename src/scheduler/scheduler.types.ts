export type SchedulePlatform = 'instagram' | 'facebook' | 'x' | 'linkedin';

export type ScheduleStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export interface ScheduledJob {
  id: string;
  postId: string;
  jobId: string; // BullMQ Job ID
  platform: SchedulePlatform;
  scheduledAt: Date;
  status: 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformConfirmation {
  postId: string;
  platformPostId: string;
  status: 'published' | 'failed';
  failureReason?: string;
  timestamp: Date;
}