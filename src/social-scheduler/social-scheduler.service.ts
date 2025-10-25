import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  Platform,
  Post,
  PostStatus,
  ScheduleJobStatus,
  SocialAccount,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from 'src/common/utility/encryption.service';
import { FacebookPlatformService } from './platforms/facebook-platform.service';
import {
  PlatformServiceMap,
  ScheduledPost,
} from './interfaces/social-scheduler.interface';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class SocialSchedulerService {
  private readonly logger = new Logger(SocialSchedulerService.name);
  private readonly platformServices: PlatformServiceMap = {};

  constructor(
    @InjectQueue('social-posting') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookPlatformService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.registerPlatformServices();
  }

  private registerPlatformServices(): void {
    this.platformServices[Platform.META] = this.facebookService;
  }

  async schedulePost(
    postId: string,
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    //get post
    const post = await this.fetchPost(postId);
    try {
      // Determine target platform from post metadata
      const targetPlatform = this.getTargetPlatform(post);

      // Use native scheduling only for Facebook Pages (Instagram doesn't support native scheduling)
      if (targetPlatform === 'FACEBOOK' && this.canUseNativeScheduling(post)) {
        this.logger.log(
          `Using native scheduling for Facebook page post ${post.id}`,
        );
        return await this.scheduleWithNativeApi(post);
      }

      // Use BullMQ for Instagram and other platforms
      this.logger.log(
        `Using BullMQ scheduling for ${targetPlatform} post ${post.id}`,
      );
      return await this.scheduleWithBullMQ(post);
    } catch (error) {
      await this.handleSchedulingError(post.id, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async publishImmediately(
    postId: string,
  ): Promise<{ success: boolean; error?: string; jobId?: string }> {
    //get post
    const post = await this.fetchPost(postId);
    try {
      const targetPlatform = this.getTargetPlatform(post);
      const platformService = this.resolvePlatformService(post);
      const platformPost = await this.preparePlatformPost(post);

      this.logger.log(
        `Publishing post ${post.id} immediately to ${targetPlatform}`
      );

      const result = await platformService.publishImmediately(platformPost);

      if (!result.success) {
        throw new Error(result.error || 'Failed to publish immediately');
      }

      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
            pageAccountId: platformPost.metadata.pageAccountId,
            jobId: result.platformPostId,
          metadata: {
            ...((post.metadata as Record<string, any>) || {}),
            publishedPlatform: targetPlatform,
          },
          queueStatus: ScheduleJobStatus.SCHEDULED,
        },
      });

      this.logger.log(
        `✅ Published post ${post.id} immediately to ${targetPlatform}`,
      );

      return { success: true, jobId: result.platformPostId };
    } catch (error) {
      await this.handleSchedulingError(post.id, error);
      this.logger.error(
        `❌ Failed to publish post ${post.id} immediately: ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Determines the target platform (FACEBOOK or INSTAGRAM) from post metadata
   */
  private getTargetPlatform(post: any): 'FACEBOOK' | 'INSTAGRAM' {
    // Check metadata for explicit platform
    if (post.metadata?.platform === 'INSTAGRAM') {
      return 'INSTAGRAM';
    }
    // Default to FACEBOOK for META accounts
    return 'FACEBOOK';
  }

  /**
   * Checks if native scheduling can be used (only for Facebook Pages)
   */
  private canUseNativeScheduling(post: any): boolean {
    const sa = post.socialAccount;

    // Must be META platform
    if (sa.platform !== Platform.META) return false;

    // Must be a PAGE account
    if (sa.accountType !== 'PAGE') return false;

    // Must have pages data with valid access token
    if (!sa.pages || sa.pages.length === 0) {
      this.logger.warn(
        `Social account ${sa.id} is PAGE type but has no pages data`,
      );
      return false;
    }

    const targetPlatform = this.getTargetPlatform(post);

    // Instagram doesn't support native scheduling via API
    if (targetPlatform === 'INSTAGRAM') {
      this.logger.debug('Instagram posts use BullMQ scheduling');
      return false;
    }

    return true;
  }

  private async scheduleWithNativeApi(
    post: any,
  ): Promise<{ success: boolean; jobId?: string }> {
    const pageAccount = post.socialAccount.pages?.[0];

    if (!pageAccount) {
      throw new Error('No connected page account found for native scheduling');
    }

    if (!pageAccount.accessToken) {
      throw new Error('Page account missing access token');
    }

    const decryptedToken = await this.encryptionService.decrypt(
      pageAccount.accessToken,
    );

    const mediaUrls = await this.getMediaFiles(post.mediaFileIds || []);

    const scheduledPost: ScheduledPost = {
      id: post.id,
      content: post.content,
      mediaUrls,
      scheduledAt: post.scheduledAt,
      metadata: {
        contentType: post.metadata?.contentType,
        accessToken: decryptedToken,
        pageId: pageAccount.platformPageId,
        pageAccountId: pageAccount.id,
        targetPlatform: 'FACEBOOK',
      },
    };

    this.logger.debug(`Scheduling post with native Facebook API:`, {
      postId: post.id,
      pageId: pageAccount.platformPageId,
      scheduledAt: post.scheduledAt,
    });

    const platformService = this.resolvePlatformService(post);
    const result = await platformService.schedulePost(scheduledPost);

    if (!result.success) {
      throw new Error(result.error || 'Facebook native scheduling failed');
    }

    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        jobId: result.platformPostId,
        platformPostId: result.platformPostId,
        pageAccountId: pageAccount.id,
        status: PostStatus.SCHEDULED,
        queueStatus: ScheduleJobStatus.SCHEDULED,
        metadata: {
          ...((post.metadata as Record<string, any>) || {}),
          schedulingMethod: 'NATIVE',
          targetPlatform: 'FACEBOOK',
        },
      },
    });

    this.logger.log(
      `✅ Scheduled post ${post.id} with Facebook native API, platformPostId: ${result.platformPostId}`,
    );

    return { success: true, jobId: result.platformPostId };
  }

  private async scheduleWithBullMQ(
    post: any,
  ): Promise<{ success: boolean; jobId?: string }> {
    const scheduledTime = new Date(post.scheduledAt).getTime();
    const currentTime = new Date().getTime();
    const delay = Math.max(scheduledTime - currentTime, 0);

    if (delay === 0) {
      this.logger.warn(
        `Post ${post.id} scheduled time is in the past, will process immediately`,
      );
    }

    const targetPlatform = this.getTargetPlatform(post);

    const job = await this.queue.add(
      `post-${post.id}`,
      {
        postId: post.id,
        platform: post.socialAccount.platform,
        targetPlatform,
      },
      {
        delay,
        jobId: post.id,
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
          count: 1000,
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        jobId: job.id,
        status: PostStatus.SCHEDULED,
        queueStatus: ScheduleJobStatus.QUEUED,
        metadata: {
          ...((post.metadata as Record<string, any>) || {}),
          schedulingMethod: 'BULLMQ',
          targetPlatform,
        },
      },
    });

    this.logger.log(
      `✅ Scheduled post ${post.id} in BullMQ for ${targetPlatform}, delay: ${delay}ms`,
    );

    return { success: true, jobId: job.id };
  }

  async processScheduledPost(data: {
    postId: string;
    retryCount?: number;
  }): Promise<void> {
    const { postId, retryCount = 0 } = data;

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          include: {
            pages: true,
          },
        },
      },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.status !== PostStatus.SCHEDULED) {
      this.logger.warn(
        `Post ${postId} has status ${post.status}, expected SCHEDULED. Skipping.`,
      );
      return;
    }

    const platform = post.socialAccount.platform;
    const platformService = this.platformServices[platform];

    if (!platformService) {
      throw new Error(`No platform service found for: ${platform}`);
    }

    try {
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHING,
          queueStatus: ScheduleJobStatus.PROCESSING,
          retryCount,
        },
      });

      const platformPost = await this.preparePlatformPost(post);
      const result = await platformService.publishImmediately(platformPost);

      if (!result.success) {
        throw new Error(
          result.error || `Platform ${platform} returned unsuccessful result`,
        );
      }

      const targetPlatform = this.getTargetPlatform(post);

      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
          metadata: {
            ...((post.metadata as Record<string, any>) || {}),
            publishedPlatform: targetPlatform,
            ...(result.metadata && { platformMetadata: result.metadata }),
          },
          queueStatus: ScheduleJobStatus.SCHEDULED,
        },
      });

      this.logger.log(
        `✅ Successfully published post ${postId} to ${targetPlatform}`,
      );
    } catch (error) {
      await this.handlePublishingError(postId, error, retryCount);
      throw error;
    }
  }

  private async preparePlatformPost(post: any): Promise<ScheduledPost> {

      const mediaUrls = await this.getMediaFiles(post.mediaFileIds || []);

    const basePost: ScheduledPost = {
      id: post.id,
      content: post.content,
      mediaUrls,
      scheduledAt: post.scheduledAt,
      metadata: {},
    };

    const targetPlatform = this.getTargetPlatform(post);

    if (post.socialAccount.platform === Platform.META) {
      const pageAccount = post.socialAccount.pages?.[0];

      if (pageAccount?.accessToken) {
        // Facebook/Instagram Page post
        const decryptedToken = await this.encryptionService.decrypt(
          pageAccount.accessToken,
        );

        basePost.metadata = {
          accessToken: decryptedToken,
          pageId: pageAccount.platformPageId,
          pageAccountId: pageAccount.id,
          targetPlatform,
          contentType: post.metadata.contentType
        };

        // Add Instagram business account ID if targeting Instagram
        if (targetPlatform === 'INSTAGRAM' && pageAccount.instagramBusinessId) {
          basePost.metadata.instagramBusinessId =
            pageAccount.instagramBusinessId;
        }
      } else {
        // META Profile post (fallback)
        const decryptedToken = await this.encryptionService.decrypt(
          post.socialAccount.accessToken,
        );

        basePost.metadata = {
          accessToken: decryptedToken,
          platformAccountId: post.socialAccount.platformAccountId,
          targetPlatform,
        };
      }
    } else {
      // Other platforms
      const decryptedToken = await this.encryptionService.decrypt(
        post.socialAccount.accessToken,
      );

      basePost.metadata = {
        accessToken: decryptedToken,
        platformAccountId: post.socialAccount.platformAccountId,
      };
    }

    return basePost;
  }

  private async handleSchedulingError(
    postId: string,
    error: any,
  ): Promise<void> {
    try {
      const errorMessage = error?.message || 'Unknown error';
      this.logger.error(`Scheduling error for post ${postId}:`, errorMessage);

      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.FAILED,
          errorMessage: errorMessage.substring(0, 1000),
          queueStatus: ScheduleJobStatus.FAILED,
        },
      });
    } catch (dbError) {
      this.logger.error(
        `Failed to update post ${postId} error status:`,
        dbError,
      );
    }
  }

  private async handlePublishingError(
    postId: string,
    error: any,
    retryCount: number,
  ): Promise<void> {
    try {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        this.logger.error(`Post ${postId} not found during error handling`);
        return;
      }

      const newRetryCount = retryCount + 1;
      const maxRetries = post.maxRetries || 3;
      const canRetry = newRetryCount < maxRetries;
      const errorMessage = error?.message || 'Unknown error';

      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: canRetry ? PostStatus.SCHEDULED : PostStatus.FAILED,
          queueStatus: canRetry
            ? ScheduleJobStatus.RETRYING
            : ScheduleJobStatus.FAILED,
          retryCount: newRetryCount,
          errorMessage: errorMessage.substring(0, 1000),
        },
      });

      if (canRetry) {
        const delay = Math.pow(2, newRetryCount) * 60 * 1000; // Exponential backoff
        this.logger.log(
          `Scheduling retry ${newRetryCount}/${maxRetries} for post ${postId} in ${delay}ms`,
        );

        await this.queue.add(
          `retry-${postId}-${newRetryCount}`,
          { postId, retryCount: newRetryCount },
          {
            delay,
            jobId: `retry-${postId}-${newRetryCount}`,
            removeOnComplete: true,
          },
        );
      } else {
        this.logger.error(
          `Post ${postId} failed permanently after ${maxRetries} attempts: ${errorMessage}`,
        );
      }
    } catch (dbError) {
      this.logger.error(
        `Failed to handle publishing error for post ${postId}:`,
        dbError,
      );
    }
  }

  async cancelScheduledPost(
    postId: string,
    organizationId: string,
  ): Promise<{ success: boolean; error?: string; message: string }> {
    try {
      const post = await this.prisma.post.findUnique({
        where: { id: postId, organizationId },
        include: {
          socialAccount: {
            include: { pages: true },
          },
        },
      });

      if (!post) throw new Error('Post not found');

      const metadata =
        post.metadata &&
        typeof post.metadata === 'object' &&
        !Array.isArray(post.metadata)
          ? (post.metadata as Record<string, any>)
          : {};

      const platform = metadata.platform as string | undefined;
      const schedulingMethod = metadata.schedulingMethod as string | undefined;

      // 🟢 If post is for Facebook & natively scheduled, handle directly
      if (
        platform === 'FACEBOOK' &&
        post.platformPostId &&
        post.status === PostStatus.SCHEDULED &&
        schedulingMethod === 'NATIVE'
      ) {
        const pageAccount = post.socialAccount.pages?.[0];
        if (!pageAccount?.accessToken)
          throw new Error('Missing page access token for Facebook post');

        const decryptedToken = await this.encryptionService.decrypt(
          pageAccount.accessToken,
        );

        const platformService =
          this.platformServices[post.socialAccount.platform];
        if (!platformService?.deleteScheduledPost)
          throw new Error('Platform service for Facebook not available');

        await platformService.deleteScheduledPost(
          post.platformPostId,
          decryptedToken,
        );

        this.logger.log(
          `🟢 Cancelled native Facebook scheduled post: ${post.platformPostId}`,
        );
      } else {
        // 🧰 For other platforms (or non-native scheduling): remove from queue
        const job = await this.queue.getJob(postId);
        if (job) {
          await job.remove();
          this.logger.log(`Removed job ${postId} from BullMQ queue`);
        }

        // Remove retry jobs if any
        const retryJobs = await this.queue.getJobs(['delayed', 'waiting']);
        for (const retryJob of retryJobs) {
          if (retryJob?.data.postId === postId) {
            await retryJob.remove();
            this.logger.log(`Removed retry job for post ${postId}`);
          }
        }
      }

      // 📝 Update DB record
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.CANCELED,
          queueStatus: ScheduleJobStatus.CANCELLED,
        },
      });

      this.logger.log(`✅ Successfully cancelled post ${postId}`);
      return {
        success: true,
        message: 'Scheduled post cancelled successfully.',
      };
    } catch (error) {
      this.logger.error(`❌ Error cancelling post ${postId}:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to cancel scheduled post.',
      };
    }
  }

  async getQueueMetrics() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
      };
    } catch (error) {
      this.logger.error('Error getting queue metrics:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
      };
    }
  }

  private resolvePlatformService(post: any) {
    // For META platform, always use Facebook service (handles both FB and IG)
    if (post.socialAccount.platform === Platform.META) {
      return this.facebookService;
    }

    // For other platforms, use registered service
    const service = this.platformServices[post.socialAccount.platform];

    if (!service) {
      throw new Error(
        `No platform service found for ${post.socialAccount.platform}`,
      );
    }

    return service;
  }

  private async fetchPost(postId: string): Promise<any> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          include: {
            pages: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }

    return post;
  }

  private async getMediaFiles(mediaIds: string[]) {
    const mediaFiles = await this.prisma.mediaFile.findMany({
      where: { id: { in: mediaIds } },
      select: { url: true },
    });

    const mediaUrls = mediaFiles.map((f) => f.url);
    return mediaUrls;
  }
}
