import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform, PostStatus, ScheduleJobStatus } from '@prisma/client';
import { EncryptionService } from 'src/common/utility/encryption.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  JobData,
  PlatformServiceMap,
  ProcessJobData,
  ScheduledPost,
} from './interfaces/social-scheduler.interface';
import { FacebookPlatformService } from './platforms/facebook-platform.service';
import { InstagramPlatformService } from './platforms/instagram-platform.service';
import { Queue } from 'bullmq';
import { ScheduleResult, CancelResult } from './types/scheduler.types';
import { RETRY_CONFIG, ERROR_MESSAGES } from './constants/scheduler.constants';
import * as moment from 'moment-timezone';

@Injectable()
export class SocialSchedulerService {
  private readonly logger = new Logger(SocialSchedulerService.name);
  private readonly platformServices: PlatformServiceMap = {};
  private readonly maxRetryCount = RETRY_CONFIG.MAX_RETRIES;

  constructor(
    @InjectQueue('social-posting') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookPlatformService,
    private readonly encryptionService: EncryptionService,
    private readonly instagramService: InstagramPlatformService,
  ) {
    this.registerPlatformServices();
  }


  private registerPlatformServices(): void {
    this.platformServices[Platform.META] = this.facebookService;
    this.platformServices[Platform.INSTAGRAM] = this.instagramService;
  }

  async schedulePost(postId: string): Promise<ScheduleResult> {
    try {
      const post = await this.fetchPost(postId);

      // Route based on platform and capabilities
      if (this.getTargetPlatform(post) === 'INSTAGRAM') {
        return await this.scheduleInstagramPost(post);
      }

      if (this.canUseNativeScheduling(post)) {
        return await this.scheduleWithNativeApi(post);
      }

      return await this.scheduleWithBullMQ(post);
    } catch (error) {
      return this.handleSchedulingFailure(postId, error);
    }
  }

  async publishImmediately(postId: string): Promise<ScheduleResult> {
    try {
      const post = await this.fetchPost(postId);
      const targetPlatform = this.getTargetPlatform(post);
      const platformService = this.resolvePlatformService(post);
      const platformPost = await this.preparePlatformPost(post);

      this.logger.log(
        `Publishing post ${postId} immediately to ${targetPlatform}`,
      );

      const result = await platformService.publishImmediately(platformPost);

      if (!result.success) {
        throw new Error(result.error || 'Failed to publish immediately');
      }

      await this.updatePublishedPost(
        post,
        result,
        targetPlatform,
        platformPost,
      );

      this.logger.log(
        `✅ Published post ${postId} immediately to ${targetPlatform}`,
      );
      return { success: true, jobId: result.platformPostId };
    } catch (error) {
      await this.handleSchedulingError(postId, error);
      this.logger.error(
        `❌ Failed to publish post ${postId} immediately: ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }

  async processScheduledPost(data: ProcessJobData): Promise<void> {
    const { postId, retryCount = 0, containerId } = data;

    const post = await this.fetchPost(postId);

    if (!this.isPostScheduled(post)) {
      this.logger.warn(
        `Post ${postId} has status ${post.status}, expected SCHEDULED. Skipping.`,
      );
      return;
    }

    try {
      await this.updatePostStatus(
        postId,
        PostStatus.PUBLISHING,
        ScheduleJobStatus.PROCESSING,
        retryCount,
      );

      const platformPost = await this.preparePlatformPost(post);

      // Handle Instagram container if present
      if (this.getTargetPlatform(post) === 'INSTAGRAM' && containerId) {
        platformPost.metadata.containerId = containerId;
        this.logger.log(`Publishing Instagram container: ${containerId}`);
      }

      const platformService = this.resolvePlatformService(post);
      const result = await platformService.publishImmediately(platformPost);

      if (!result.success) {
        throw new Error(
          result.error ||
            ERROR_MESSAGES.PUBLISH_FAILED(this.getTargetPlatform(post)),
        );
      }

      await this.markPostAsPublished(
        postId,
        result,
        this.getTargetPlatform(post),
        post.metadata,
      );
      this.logger.log(
        `✅ Successfully published post ${postId} to ${this.getTargetPlatform(post)}`,
      );
    } catch (error) {
      await this.handlePublishingError(postId, error, retryCount);
      throw error;
    }
  }

  async cancelScheduledPost(
    postId: string,
    organizationId: string,
  ): Promise<CancelResult> {
    try {
      const post = await this.fetchPostWithOrg(postId, organizationId);
      const metadata = this.extractMetadata(post.metadata);

      // Execute cancellation steps in parallel where possible
      await Promise.allSettled([
        this.cancelPlatformResources(post, metadata),
        this.removeQueueJobs(postId),
      ]);

      await this.markPostAsCancelled(postId);

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
      return this.getEmptyMetrics();
    }
  }

  // ==================== Private Methods ====================

  private async scheduleInstagramPost(post: any): Promise<ScheduleResult> {
    const platformPost = await this.preparePlatformPost(post);
    // Create Instagram container
    this.logger.log(`Creating Instagram container for post ${post.id}`);
    console.log('Scheduling Instagram post with data:', platformPost);
    const containerResult =
      await this.instagramService.schedulePost(platformPost);

    if (!containerResult.success || !containerResult.metadata?.containerId) {
      throw new Error(
        containerResult.error || ERROR_MESSAGES.CONTAINER_CREATION_FAILED,
      );
    }

    const containerId = containerResult.metadata.containerId;
    const delay = this.calculateDelay(post.scheduledAt, post.timezone);

    const job = await this.queueInstagramJob(post, containerId, delay);
    await this.updateScheduledPost(
      post.id,
      String(job.id),
      containerId,
      containerResult.metadata,
    );

    this.logger.log(
      `✅ Scheduled Instagram post ${post.id}, container: 17846582550594529, delay: ${delay}ms`,
    );
     return { success: true, jobId: String(job.id) };
  }

  private async scheduleWithNativeApi(post: any): Promise<ScheduleResult> {
    const pageAccount = this.getPageAccount(post);
    const [decryptedToken, mediaUrls] = await Promise.all([
      this.encryptionService.decrypt(pageAccount.accessToken),
      this.getMediaFiles(post.mediaFileIds || []),
    ]);

    const scheduledPost = this.buildScheduledPost(
      post,
      mediaUrls,
      decryptedToken,
      pageAccount,
      'FACEBOOK',
    );
    const platformService = this.resolvePlatformService(post);

    const result = await platformService.schedulePost(scheduledPost);

    if (!result.success) {
      throw new Error(result.error || ERROR_MESSAGES.NATIVE_SCHEDULING_FAILED);
    }

    await this.updateNativeScheduledPost(
      post.id,
      result.platformPostId,
      pageAccount.id,
    );

    this.logger.log(
      `✅ Scheduled post ${post.id} with Facebook native API, platformPostId: ${result.platformPostId}`,
    );
    return { success: true, jobId: result.platformPostId };
  }

  private async scheduleWithBullMQ(post: any): Promise<ScheduleResult> {
    const delay = this.calculateDelay(post.scheduledAt, post.timezone);
    const targetPlatform = this.getTargetPlatform(post);

    const job = await this.queueJob(post, targetPlatform, delay);
    await this.updateBullMQScheduledPost(
      post.id,
      String(job.id),
      targetPlatform,
    );

    this.logger.log(
      `✅ Scheduled post ${post.id} in BullMQ for ${targetPlatform}, delay: ${delay}ms`,
    );
    return { success: true, jobId: String(job.id) };
  }

  // Helper Methods
  private getTargetPlatform(post: any): 'FACEBOOK' | 'INSTAGRAM' {
    return post.metadata?.platform === 'INSTAGRAM' ? 'INSTAGRAM' : 'FACEBOOK';
  }

  private canUseNativeScheduling(post: any): boolean {
    const { socialAccount } = post;

    // Only META platform with PAGE account type can use native scheduling
    if (
      socialAccount.platform !== Platform.META ||
      socialAccount.accountType !== 'PAGE'
    ) {
      return false;
    }

    if (!socialAccount.pages?.length) {
      this.logger.warn(
        `Social account ${socialAccount.id} is PAGE type but has no pages data`,
      );
      return false;
    }

    // Instagram posts use BullMQ scheduling
    if (this.getTargetPlatform(post) === 'INSTAGRAM') {
      this.logger.debug('Instagram posts use BullMQ scheduling');
      return false;
    }

    return true;
  }

  private isPostScheduled(post: any): boolean {
    return post.status === PostStatus.SCHEDULED;
  }

  private calculateDelay(scheduledAt: Date, timezone: string): number {
    // const scheduledTime = new Date(scheduledAt).getTime();
    // const currentTime = Date.now();
    // const delay = Math.max(scheduledTime - currentTime, 0);

    // if (delay === 0) {
    //   this.logger.warn(
    //     'Scheduled time is in the past, will process immediately',
    //   );
    // }

    // return delay;
     // Convert local scheduled time to UTC
 // Parse scheduledAt as a local time in the given timezone
 console.log(`scheduledAt: ${scheduledAt} timezone: ${timezone}`)
  const scheduledMoment = moment.tz(scheduledAt, timezone);
  console.log(`scheduledMoment: ${scheduledMoment}`)

  // Get current time in same timezone
  const nowMoment = moment.tz(timezone);
  console.log(`nowMoment: ${nowMoment}`)

  const delay = Math.max(scheduledMoment.diff(nowMoment), 0);
  console.log(`delay: ${delay}`)
  return delay;
  }

  private getPageAccount(post: any) {
    const pageAccount = post.socialAccount.pages?.[0];

    if (!pageAccount) {
      throw new Error(ERROR_MESSAGES.NO_PAGE_ACCOUNT);
    }

    if (!pageAccount.accessToken) {
      throw new Error(ERROR_MESSAGES.MISSING_ACCESS_TOKEN);
    }

    return pageAccount;
  }

  private buildScheduledPost(
    post: any,
    mediaUrls: string[],
    accessToken: string,
    pageAccount: any,
    targetPlatform: 'FACEBOOK' | 'INSTAGRAM',
  ): ScheduledPost {
    return {
      id: post.id,
      content: post.content,
      mediaUrls,
      scheduledAt: post.scheduledAt,
      metadata: {
        contentType: post.metadata?.contentType,
        accessToken,
        pageId: pageAccount.platformPageId,
        pageAccountId: pageAccount.id,
        targetPlatform,
      },
    };
  }

  private async preparePlatformPost(post: any): Promise<ScheduledPost> {
    const [mediaUrls, targetPlatform] = await Promise.all([
      this.getMediaFiles(post.mediaFileIds || []),
      Promise.resolve(this.getTargetPlatform(post)),
    ]);

    const basePost: ScheduledPost = {
      id: post.id,
      content: post.content,
      mediaUrls,
      scheduledAt: post.scheduledAt,
      metadata: {},
    };

    if (post.socialAccount.platform === Platform.META) {
      return this.prepareMetaPlatformPost(basePost, post, targetPlatform);
    }

    return this.prepareGenericPlatformPost(basePost, post);
  }

  private async prepareMetaPlatformPost(
    basePost: ScheduledPost,
    post: any,
    targetPlatform: 'FACEBOOK' | 'INSTAGRAM',
  ): Promise<ScheduledPost> {
    const pageAccount = post.socialAccount.pages?.[0];
    let accessToken: string;

    if (pageAccount?.accessToken) {
      accessToken = await this.encryptionService.decrypt(
        pageAccount.accessToken,
      );
      basePost.metadata = {
        accessToken,
        pageId: pageAccount.platformPageId,
        pageAccountId: pageAccount.id,
        targetPlatform,
        contentType: post.metadata?.contentType,
      };

      if (targetPlatform === 'INSTAGRAM' && pageAccount.instagramBusinessId) {
        basePost.metadata.instagramBusinessId = pageAccount.instagramBusinessId;
      }
    } else {
      accessToken = await this.encryptionService.decrypt(
        post.socialAccount.accessToken,
      );
      basePost.metadata = {
        accessToken,
        platformAccountId: post.socialAccount.platformAccountId,
        targetPlatform,
      };
    }

    return basePost;
  }

  private async prepareGenericPlatformPost(
    basePost: ScheduledPost,
    post: any,
  ): Promise<ScheduledPost> {
    const decryptedToken = await this.encryptionService.decrypt(
      post.socialAccount.accessToken,
    );

    basePost.metadata = {
      accessToken: decryptedToken,
      platformAccountId: post.socialAccount.platformAccountId,
    };

    return basePost;
  }

  private resolvePlatformService(post: any) {
    if (post.socialAccount.platform === Platform.META) {
      return this.getTargetPlatform(post) === 'INSTAGRAM'
        ? this.instagramService
        : this.facebookService;
    }

    const service = this.platformServices[post.socialAccount.platform];
    if (!service) {
      throw new Error(
        ERROR_MESSAGES.NO_PLATFORM_SERVICE(post.socialAccount.platform),
      );
    }

    return service;
  }

  // Queue Management
  private async queueInstagramJob(
    post: any,
    containerId: string,
    delay: number,
  ) {
        console.log(`delsy: ${delay}`)
    return this.queue.add(
      `post-${post.id}`,
      {
        postId: post.id,
        platform: post.socialAccount.platform,
        targetPlatform: 'INSTAGRAM',
        containerId,
      } as JobData,
      {
        delay,
        jobId: post.id,
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for analysis
      },
    );
  }

  private async queueJob(
    post: any,
    targetPlatform: Platform,
    delay: number,
  ) {
    return this.queue.add(
      `post-${post.id}`,
      {
        postId: post.id,
        platform: post.socialAccount.platform,
        targetPlatform,
      } as JobData,
      {
        delay,
        jobId: post.id,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  private async removeQueueJobs(postId: string): Promise<void> {
    try {
      const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);
      const jobsToRemove = jobs.filter(
        (job) =>
          job?.data?.postId === postId ||
          job?.id === postId ||
          job?.name === `post-${postId}`,
      );

      await Promise.allSettled(jobsToRemove.map((job) => job.remove()));

      if (jobsToRemove.length > 0) {
        this.logger.log(
          `Removed ${jobsToRemove.length} queue jobs for post ${postId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error removing queue jobs for post ${postId}:`, error);
      throw error;
    }
  }

  // Database Operations
  private async fetchPost(postId: string): Promise<any> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          include: { pages: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(ERROR_MESSAGES.POST_NOT_FOUND(postId));
    }

    return post;
  }

  private async fetchPostWithOrg(
    postId: string,
    organizationId: string,
  ): Promise<any> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, organizationId },
      include: {
        socialAccount: {
          include: { pages: true },
        },
      },
    });

    if (!post) {
      throw new Error(ERROR_MESSAGES.POST_NOT_FOUND(postId));
    }

    return post;
  }

  private async getMediaFiles(mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];

    const mediaFiles = await this.prisma.mediaFile.findMany({
      where: { id: { in: mediaIds } },
      select: { url: true },
    });

    return mediaFiles.map((f) => f.url);
  }

  private async updatePostStatus(
    postId: string,
    status: PostStatus,
    queueStatus: ScheduleJobStatus,
    retryCount: number,
  ): Promise<void> {
    await this.prisma.post.update({
      where: { id: postId },
      data: { status, queueStatus, retryCount },
    });
  }

  private async updateScheduledPost(
    postId: string,
    jobId: string,
    containerId: string,
    containerMetadata: any,
  ): Promise<void> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        jobId,
        status: PostStatus.SCHEDULED,
        queueStatus: ScheduleJobStatus.QUEUED,
        metadata: {
          ...this.extractMetadata(existingPost.metadata),
          schedulingMethod: 'INSTAGRAM_CONTAINER',
          targetPlatform: 'INSTAGRAM',
          containerId,
          containerMetadata,
        },
      },
    });
  }

  private async updateNativeScheduledPost(
    postId: string,
    platformPostId: string,
    pageAccountId: string,
  ): Promise<void> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        jobId: platformPostId,
        platformPostId,
        pageAccountId,
        status: PostStatus.SCHEDULED,
        queueStatus: ScheduleJobStatus.SCHEDULED,
        metadata: {
          ...this.extractMetadata(existingPost.metadata),
          schedulingMethod: 'NATIVE',
          targetPlatform: 'FACEBOOK',
        },
      },
    });
  }

  private async updateBullMQScheduledPost(
    postId: string,
    jobId: string,
    targetPlatform: 'FACEBOOK' | 'INSTAGRAM',
  ): Promise<void> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        jobId,
        status: PostStatus.SCHEDULED,
        queueStatus: ScheduleJobStatus.QUEUED,
        metadata: {
          ...this.extractMetadata(existingPost.metadata),
          schedulingMethod: 'BULLMQ',
          targetPlatform,
        },
      },
    });
  }

  private async updatePublishedPost(
    post: any,
    result: any,
    targetPlatform: string,
    platformPost: ScheduledPost,
  ): Promise<void> {
    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
        pageAccountId: platformPost.metadata.pageAccountId,
        jobId: result.platformPostId,
        metadata: {
          ...this.extractMetadata(post.metadata),
          publishedPlatform: targetPlatform,
          ...(result.metadata && { publishMetadata: result.metadata }),
        },
        queueStatus: ScheduleJobStatus.SCHEDULED,
      },
    });
  }

  private async markPostAsPublished(
    postId: string,
    result: any,
    targetPlatform: string,
    existingMetadata: any,
  ): Promise<void> {
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
        metadata: {
          ...this.extractMetadata(existingMetadata),
          publishedPlatform: targetPlatform,
          ...(result.metadata && { platformMetadata: result.metadata }),
        },
        queueStatus: ScheduleJobStatus.SCHEDULED,
      },
    });
  }

  private async markPostAsCancelled(postId: string): Promise<void> {
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.CANCELED,
        queueStatus: ScheduleJobStatus.CANCELLED,
      },
    });
  }

  // Error Handling
  private handleSchedulingFailure(postId: string, error: any): ScheduleResult {
    this.handleSchedulingError(postId, error);
    return {
      success: false,
      error: error.message,
    };
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
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      if (!post) {
        this.logger.error(`Post ${postId} not found during error handling`);
        return;
      }

      const newRetryCount = retryCount + 1;
      const maxRetries = post.maxRetries || this.maxRetryCount;
      const canRetry = newRetryCount < maxRetries;
      const errorMessage = error?.message || 'Unknown error';

      const updateData: any = {
        queueStatus: canRetry
          ? ScheduleJobStatus.RETRYING
          : ScheduleJobStatus.FAILED,
        retryCount: newRetryCount,
        errorMessage: errorMessage.substring(0, 1000),
      };

      if (!canRetry) {
        updateData.status = PostStatus.FAILED;
        updateData.failedAt = new Date();
      }

      await this.prisma.post.update({
        where: { id: postId },
        data: updateData,
      });

      if (canRetry) {
        await this.scheduleRetry(postId, newRetryCount, maxRetries);
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

  private async scheduleRetry(
    postId: string,
    retryCount: number,
    maxRetries: number,
  ): Promise<void> {
    const delay =
      Math.pow(RETRY_CONFIG.BACKOFF_BASE, retryCount) *
      RETRY_CONFIG.INITIAL_DELAY_MS;

    await this.queue.add(
      `retry-${postId}-${retryCount}`,
      {
        postId,
        retryCount,
        isRetry: true,
      },
      {
        delay,
        jobId: `retry-${postId}-${retryCount}`,
        removeOnComplete: true,
        attempts: maxRetries - retryCount,
      },
    );

    this.logger.log(
      `Scheduled retry ${retryCount} for post ${postId} in ${delay}ms`,
    );
  }

  // Platform Resource Management
  private async cancelPlatformResources(
    post: any,
    metadata: Record<string, any>,
  ): Promise<void> {
    const targetPlatform = metadata.targetPlatform as string | undefined;
    const schedulingMethod = metadata.schedulingMethod as string | undefined;
    const containerId = metadata.containerId as string | undefined;

    const cancellationPromises: Promise<void>[] = [];

    if (targetPlatform === 'INSTAGRAM' && containerId) {
      cancellationPromises.push(
        this.cancelInstagramContainer(post, containerId),
      );
    }

    if (
      targetPlatform === 'FACEBOOK' &&
      post.platformPostId &&
      post.status === PostStatus.SCHEDULED &&
      schedulingMethod === 'NATIVE'
    ) {
      cancellationPromises.push(this.cancelFacebookNativePost(post));
    }

    await Promise.allSettled(cancellationPromises);
  }

  private async cancelInstagramContainer(
    post: any,
    containerId: string,
  ): Promise<void> {
    const pageAccount = post.socialAccount.pages?.[0];
    if (pageAccount?.accessToken) {
      try {
        const decryptedToken = await this.encryptionService.decrypt(
          pageAccount.accessToken,
        );
        await this.instagramService.deleteScheduledPost(
          containerId,
          decryptedToken,
        );
        this.logger.log(`🗑️ Deleted Instagram container: ${containerId}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete Instagram container ${containerId}:`,
          error,
        );
        throw error;
      }
    }
  }

  private async cancelFacebookNativePost(post: any): Promise<void> {
    const pageAccount = post.socialAccount.pages?.[0];
    if (!pageAccount?.accessToken) {
      throw new Error(
        'Missing page access token for Facebook post cancellation',
      );
    }

    try {
      const decryptedToken = await this.encryptionService.decrypt(
        pageAccount.accessToken,
      );
      const platformService =
        this.platformServices[post.socialAccount.platform];

      if (platformService?.deleteScheduledPost) {
        await platformService.deleteScheduledPost(
          post.platformPostId,
          decryptedToken,
        );
        this.logger.log(
          `🗑️ Cancelled native Facebook scheduled post: ${post.platformPostId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel Facebook native post ${post.platformPostId}:`,
        error,
      );
      throw error;
    }
  }

  // Utility Methods
  private extractMetadata(metadata: any): Record<string, any> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, any>)
      : {};
  }

  private getEmptyMetrics() {
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
