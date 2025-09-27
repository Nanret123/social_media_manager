import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform, ScheduleJobStatus } from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { SocialPostingService } from 'src/social-posting/social-posting.service';

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

export interface PostMetadata {
  options?: Record<string, any>;
  // you can add more fields as needed
  hashtags?: string[];
  mentions?: string[];
  linkPreview?: boolean;
}

// Queue-related types
export interface SchedulePostData {
  postId: string;
  organizationId: string;
  platform: Platform;
  accountId: string;
  content: string;
  mediaFileIds?: string[];
  scheduledAt: Date;
  options?: Record<string, any>;
}


@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectQueue('post-scheduling') private readonly postQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly socialPostingService: SocialPostingService,
  ) {}

async schedulePost(data: SchedulePostData) {
    const delay = data.scheduledAt.getTime() - Date.now();
    if (delay <= 0) throw new BadRequestException('Scheduled time must be in the future');

    // Create post record first
    const post = await this.prisma.post.create({
      data: {
        id: data.postId,
        organizationId: data.organizationId,
        socialAccountId: data.accountId,
        content: data.content,
        mediaFileIds: data.mediaFileIds || [],
        scheduledAt: data.scheduledAt,
        status: 'SCHEDULED',
        metadata: data.options ? { options: data.options } : undefined,
      },
    });

    // Add to queue
    const job = await this.postQueue.add('publish-post', data, {
      delay,
      jobId: data.postId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    // Update post with job ID
    await this.prisma.post.update({
      where: { id: data.postId },
      data: { jobId: job.id.toString() },
    });

    this.logger.log(`📅 Scheduled post ${data.postId} for ${data.scheduledAt}`);
    return job;
  }

  async cancelScheduledPost(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    if (post.jobId) {
      const job = await this.postQueue.getJob(post.jobId);
      if (job) {
        await job.remove();
        this.logger.log(`🛑 Cancelled scheduled job ${post.jobId}`);
      }
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'CANCELED' },
    });
  }

  async reschedulePost(postId: string, newScheduledAt: Date) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { socialAccount: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.status !== 'SCHEDULED') {
      throw new BadRequestException('Only scheduled posts can be rescheduled');
    }

    // Cancel existing job
    if (post.jobId) {
      const job = await this.postQueue.getJob(post.jobId);
      if (job) await job.remove();
    }

    // Build new schedule data
    const scheduleData: SchedulePostData = {
      postId: post.id,
      organizationId: post.organizationId,
      platform: post.socialAccount.platform as Platform,
      accountId: post.socialAccount.id,
      content: post.content,
      mediaFileIds: post.mediaFileIds || [],
      scheduledAt: newScheduledAt,
      options: (post.metadata as PostMetadata)?.options,
    };

    return this.schedulePost(scheduleData);
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.postQueue.getWaitingCount(),
      this.postQueue.getActiveCount(),
      this.postQueue.getCompletedCount(),
      this.postQueue.getFailedCount(),
      this.postQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async publishImmediately(data: Omit<SchedulePostData, 'scheduledAt'>) {
    return this.executePublish(data.postId, {
      organizationId: data.organizationId,
      platform: data.platform,
      accountId: data.accountId,
      content: data.content,
      mediaFileIds: data.mediaFileIds,
      options: data.options,
    });
  }

  async publishScheduledPost(postId: string) {
    const post = await this.getPostWithAccount(postId);
    return this.executePublish(postId, {
      organizationId: post.organizationId,
      platform: post.socialAccount.platform,
      accountId: post.socialAccount.id,
      content: post.content,
      mediaFileIds: post.mediaFileIds,
      options: (post.metadata as PostMetadata)?.options,
    });
  }

  /** Core publishing logic used by both immediate + scheduled posts */
  private async executePublish(
    postId: string,
    postData: {
      organizationId: string;
      platform: Platform;
      accountId: string;
      content: string;
      mediaFileIds?: string[];
      options?: Record<string, any>;
    },
  ) {
    try {
      const result = await this.socialPostingService.publishPost(
        postData.organizationId,
        postData,
      );

      if (result.success) {
        await this.markPostAsPublished(postId, result.platformPostId);
      } else {
        await this.markPostAsFailed(postId, result.error);
      }
      return result;
    } catch (error) {
      await this.markPostAsFailed(postId, error.message);
      throw error;
    }
  }

  private async getPostWithAccount(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            platformAccountId: true,
            accessToken: true,
            isActive: true,
          },
        },
      },
    });
    if (!post) throw new NotFoundException(`Post with ID ${postId} not found`);
    if (!post.socialAccount) {
      throw new BadRequestException(`Post ${postId} has no associated social account`);
    }
    if (!post.socialAccount.isActive) {
      throw new BadRequestException(`Social account for post ${postId} is inactive`);
    }
    return post;
  }

  private async markPostAsPublished(postId: string, platformPostId?: string) {
    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        platformPostId,
        queueStatus: 'COMPLETED',
        errorMessage: null,
        retryCount: 0,
      },
      include: {
        socialAccount: { select: { platform: true, username: true } },
        author: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    this.logger.log(
      `✅ Post ${postId} marked as published on ${updatedPost.socialAccount.platform}`,
    );
    return updatedPost;
  }

  private async markPostAsFailed(postId: string, errorMessage?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { retryCount: true, maxRetries: true },
    });
    if (!post) {
      this.logger.warn(`Post ${postId} not found when marking as failed`);
      return;
    }

    const maxRetries = post.maxRetries || 3;
    const newRetryCount = (post.retryCount || 0) + 1;
    const finalStatus = newRetryCount >= maxRetries ? 'FAILED' : 'RETRYING';

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: finalStatus,
        queueStatus: finalStatus === 'FAILED' ? 'FAILED' : 'RETRYING',
        errorMessage: errorMessage?.substring(0, 1000),
        retryCount: newRetryCount,
      },
      include: {
        socialAccount: { select: { platform: true, username: true } },
      },
    });

    this.logger.warn(
      `❌ Post ${postId} marked as ${finalStatus} on ${updatedPost.socialAccount.platform}: ${errorMessage}`,
    );
    return updatedPost;
  }
}
