import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { SocialIntegrationService } from 'src/social-integration/social-integration.service';
import { Injectable } from '@nestjs/common';
import { PlatformServiceFactory } from 'src/platforms/platform-service.factory';
import { BasePlatformWorker } from './base/base.worker';
import { SchedulerService } from 'src/scheduler/scheduler.service';

@Injectable()
export class LinkedInWorker extends BasePlatformWorker {
  protected readonly queueName = 'linkedin:queue';
  protected readonly concurrency = 2;
  constructor(
    private readonly platformServiceFactory: PlatformServiceFactory,
    private readonly schedulerService: SchedulerService,
    private readonly socialIntegrationService: SocialIntegrationService,
    redisService: RedisService,
  ) {
    super(LinkedInWorker.name, redisService);
  }

  protected async processJob(job: Job): Promise<void> {
    const { postId, content, mediaUrls, socialAccountId } = job.data;

    try {
      this.logger.log(`Processing Instagram post: ${postId}`);

      // 1. Get access token
      const accessToken = await this.socialIntegrationService.getValidAccessToken(socialAccountId);

      // 2. Get Facebook platform service
      const platformService = this.platformServiceFactory.getService('linkedin');

      // 3. Publish post
      const result = await platformService.publishPost({
        accessToken,
        caption: content,
        mediaUrls,
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error while publishing to Linkedin');
      }

      // 4. Confirm success
      await this.schedulerService.handlePlatformConfirmation({
        postId,
        status: 'published',
        platformPostId: result.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ LinkedIn post ${postId} published successfully (FB ID: ${result.id})`);

    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      this.logger.error(`❌ Failed to process Facebook post ${postId}: ${errorMessage}`);

      // Handle specific error cases
      if (errorMessage.toLowerCase().includes('rate limit')) {
        this.logger.warn(`Rate limit hit for post ${postId}, delaying job...`);
        await job.moveToDelayed(5 * 60 * 1000); // retry after 5 mins
        return;
      }

      if (errorMessage.toLowerCase().includes('invalid token')) {
        // Could mark the account as disconnected
        this.logger.warn(`Invalid token for post ${postId}, marking as failed`);
      }

      // Confirm failure
      await this.schedulerService.handlePlatformConfirmation({
        postId,
        status: 'failed',
        failureReason: errorMessage,
        timestamp: new Date(),
      });

      throw error; // rethrow so BullMQ registers the failure
    }
  }

  protected getRateLimit(): number {
    // LinkedIn: ~5 posts per minute per account
    return 5;
  }

  protected onJobFailed(job: Job, error: Error): void {
    // Additional LinkedIn-specific failure handling
    const { postId, socialAccountId } = job.data;
    this.logger.warn(
      `LinkedIn post ${postId} for account ${socialAccountId} failed: ${error.message}`,
    );
  }
}
