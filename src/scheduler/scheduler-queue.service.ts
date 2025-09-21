import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface ScheduleJobData {
  postId: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  scheduledAt: Date;
  organizationId: string;
  socialAccountId: string;
}

@Injectable()
export class SchedulerQueueService {
  constructor(
    @InjectQueue('scheduled-posts') private readonly schedulerQueue: Queue,
  ) {}

  async addJob(jobData: ScheduleJobData, delay: number): Promise<string> {
    const job = await this.schedulerQueue.add(
      'publish-post',
      jobData,
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `post_${jobData.postId}_${jobData.platform}`,
      }
    );

    return job.id;
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.schedulerQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async getJobStatus(jobId: string): Promise<string> {
    const job = await this.schedulerQueue.getJob(jobId);
    return job ? await job.getState() : 'unknown';
  }

  async cleanupStaleJobs(): Promise<void> {
    // Clean up jobs that are stuck in active state for too long
    const staleJobs = await this.schedulerQueue.getJobs(['active'], 0, 100);
    const now = Date.now();
    
    for (const job of staleJobs) {
      if (now - job.timestamp > 300000) { // 5 minutes
        await job.moveToFailed(new Error('Job stalled'), true);
      }
    }
  }
}