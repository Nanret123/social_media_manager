import { Injectable, NotFoundException } from '@nestjs/common';
import { SchedulerQueueService } from './scheduler-queue.service';
import { PostRepository } from '../repositories/post.repository';
import { ScheduleStatus, PlatformConfirmation } from '../types/scheduler.types';

interface UpdatePostStatusDto {
  postId: string;
  status: 'published' | 'failed';
  platformPostId?: string;
  failureReason?: string;
  timestamp: Date;
  rawPayload?: any; // optional — raw API response
}

@Injectable()
export class SchedulerService {
  constructor(
    private readonly schedulerQueueService: SchedulerQueueService,
    private readonly postRepository: PostRepository,
  ) {}

  async schedulePost(postId: string, scheduledAt: Date): Promise<string> {
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Validate scheduling rules
    this.validateScheduleTime(scheduledAt);
    this.validatePostContent(post);

    // Check rate limits before scheduling
    const rateLimitCheck = await this.rateLimitService.canSchedulePost(
      post.socialAccountId,
      post.platform,
      scheduledAt,
    );

    if (!rateLimitCheck.canSchedule) {
      throw new Error(
        `Cannot schedule post: ${rateLimitCheck.reason}. Next available: ${rateLimitCheck.nextAvailable}`,
      );
    }

    // Calculate delay until posting time
    const delay = scheduledAt.getTime() - Date.now();
    if (delay < 0) {
      throw new Error('Cannot schedule post in the past');
    }

    // Add job to BullMQ queue
    const jobId = await this.schedulerQueueService.addJob(
      {
        postId: post.id,
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls,
        scheduledAt,
        organizationId: post.organizationId,
        socialAccountId: post.socialAccountId,
      },
      delay,
    );

    // Update post status and store job ID
    await this.postRepository.update(postId, {
      status: 'scheduled',
      scheduledAt,
      jobId,
    });

    // Create audit log entry
    await this.auditLogService.logScheduleEvent(post, jobId);

    return jobId;
  }

  async publishImmediately(postId: string): Promise<string> {
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Add job to queue with no delay
    const jobId = await this.schedulerQueueService.addJob(
      {
        postId: post.id,
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls,
        scheduledAt: new Date(),
        organizationId: post.organizationId,
        socialAccountId: post.socialAccountId,
      },
      0,
    ); // Zero delay

    await this.postRepository.update(postId, {
      status: 'publishing',
      jobId,
    });

    return jobId;
  }

  async cancelScheduledPost(postId: string): Promise<void> {
    const post = await this.postRepository.findById(postId);
    if (!post || !post.jobId) {
      throw new NotFoundException('Scheduled post not found');
    }

    // Remove job from BullMQ queue
    await this.schedulerQueueService.removeJob(post.jobId);

    // Update post status
    await this.postRepository.update(postId, {
      status: 'draft',
      jobId: null,
      scheduledAt: null,
    });
  }

  async handlePlatformConfirmation(
    confirmation: PlatformConfirmation,
  ): Promise<void> {
    const { postId, status, platformPostId, failureReason } = confirmation;

    const updateData: any = {
      platformPostId,
      status: status === 'published' ? 'published' : 'failed',
      publishedAt: status === 'published' ? new Date() : undefined,
      errorMessage: failureReason,
    };

    await this.postRepository.update(postId, updateData);

    if (status === 'published') {
      // Notify analytics service to start tracking this post
      await this.analyticsService.startTrackingPost(postId, platformPostId);

      // Send real-time notification to user
      await this.notificationService.notifyPostPublished(postId);
    } else {
      await this.notificationService.notifyPostFailed(postId, failureReason);
    }
  }

  async getQueueStatus(organizationId: string): Promise<any[]> {
    // Get all scheduled posts for organization
    const scheduledPosts =
      await this.postRepository.findScheduledByOrganization(organizationId);

    // Get current queue status from BullMQ for each job
    const queueStatus = await Promise.all(
      scheduledPosts.map(async (post) => {
        if (!post.jobId) return null;

        const jobStatus = await this.schedulerQueueService.getJobStatus(
          post.jobId,
        );
        return {
          postId: post.id,
          scheduledAt: post.scheduledAt,
          status: jobStatus,
          contentPreview: post.content.substring(0, 100),
        };
      }),
    );

    return queueStatus.filter(Boolean);
  }

  private validateScheduleTime(scheduledAt: Date): void {
    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

    if (scheduledAt < minScheduleTime) {
      throw new Error('Posts must be scheduled at least 5 minutes in advance');
    }
  }

  private validatePostContent(post: any): void {
    // Implement platform-specific content validation
    if (post.platform === 'instagram' && !post.mediaUrls?.length) {
      throw new Error('Instagram posts require media');
    }

    if (post.content.length > 280 && post.platform === 'x') {
      throw new Error('X posts cannot exceed 280 characters');
    }
  }


  async updatePostStatus(
    postId: string,
    status: 'pending' | 'publishing' | 'published' | 'failed',
    failureReason?: string,
    platformPostId?: string,
  ): Promise<void> {
    this.logger.log(`Updating post ${postId} -> ${status.toUpperCase()}`);

    await this.prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status,
        failureReason,
        platformPostId,
        publishedAt: status === 'published' ? new Date() : undefined,
      },
    });
  }

}
