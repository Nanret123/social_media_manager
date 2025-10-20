import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Platform, PostStatus } from '@prisma/client';
import { Queue, Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';

export interface PlatformPost {
  content: string;
  mediaUrls?: string[];
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

export interface MediaUploadData {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  altText?: string;
}

export interface IPlatformClient {
  publishPost(accountId: string, post: PlatformPost): Promise<PostingResult>;
  uploadMedia(accountId: string, media: MediaUploadData): Promise<string>;
  validateCredentials(accountId: string): Promise<boolean>;
}

interface PostMetadata {
  options?: Record<string, any>;
  [key: string]: any;
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectQueue('post-scheduling') private readonly postQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Schedule a post for future publishing
   * Note: Post record should be created BEFORE calling this method
   */
  async schedulePost(postId: string): Promise<Job> {
    //get the post details
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    })
    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }
    // Validate scheduled time
    const delay = new Date(post.scheduledAt).getTime() - Date.now();
    if (delay <= 0) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Add job to queue with retry configuration
    const job = await this.postQueue.add('publish-post', post, {
      delay,
      jobId: postId, // Use postId as jobId for idempotency
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: false, // Keep failed jobs for debugging
    });

    // Update post with job reference
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        jobId: job.id,
        queueStatus: 'QUEUED',
      },
    });

    this.logger.log(
      `📅 Scheduled post ${postId} for ${post.scheduledAt} (delay: ${Math.round(delay / 1000)}s)`,
    );

    return job;
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, jobId: true, status: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== PostStatus.SCHEDULED) {
      throw new BadRequestException(
        `Post is ${post.status}, cannot cancel. Only SCHEDULED posts can be cancelled.`,
      );
    }

    // Remove job from queue if exists
    if (post.jobId) {
      try {
        const job = await this.postQueue.getJob(post.jobId);
        if (job) {
          await job.remove();
          this.logger.log(`🛑 Removed job ${post.jobId} from queue`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to remove job ${post.jobId}: ${error.message}`,
        );
        // Continue with post status update even if job removal fails
      }
    }

    // Update post status
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.CANCELED,
        queueStatus: 'CANCELLED',
        jobId: null,
      },
    });

    this.logger.log(`✅ Cancelled post ${postId}`);
  }

  /**
   * Reschedule a post to a new time
   */
  async reschedulePost(postId: string, newScheduledAt: Date): Promise<Job> {
    // Validate new scheduled time
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== PostStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot reschedule post with status ${post.status}. Only SCHEDULED posts can be rescheduled.`,
      );
    }

    // Cancel existing job
    if (post.jobId) {
      try {
        const job = await this.postQueue.getJob(post.jobId);
        if (job) {
          await job.remove();
          this.logger.log(`🔄 Removed old job ${post.jobId} for rescheduling`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to remove old job during reschedule: ${error.message}`,
        );
      }
    }

    // Update post scheduled time
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt: newScheduledAt.toISOString(),
        jobId: null, // Will be set by schedulePost
      },
    });


    this.logger.log(
      `🔄 Rescheduling post ${postId} from ${post.scheduledAt} to ${newScheduledAt.toISOString()}`,
    );

    return this.schedulePost(postId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this.postQueue.getWaitingCount(),
        this.postQueue.getActiveCount(),
        this.postQueue.getCompletedCount(),
        this.postQueue.getFailedCount(),
        this.postQueue.getDelayedCount(),
        this.postQueue.isPaused(),
      ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed,
    };
  }

  /**
   * Get detailed information about a specific job
   */
  async getJobDetails(jobId: string): Promise<Job | null> {
    try {
      const job = await this.postQueue.getJob(jobId);
      return job;
    } catch (error) {
      this.logger.error(`Failed to fetch job ${jobId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(jobId: string): Promise<void> {
    const job = await this.postQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new BadRequestException(
        `Job is ${state}, cannot retry. Only failed jobs can be retried.`,
      );
    }

    await job.retry();
    this.logger.log(`🔁 Retrying failed job ${jobId}`);
  }

  /**
   * Clean old completed jobs
   */
  async cleanCompletedJobs(
    olderThanMs: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    await this.postQueue.clean(olderThanMs, 100, 'completed');
    this.logger.log(`🧹 Cleaned completed jobs older than ${olderThanMs}ms`);
  }
}
