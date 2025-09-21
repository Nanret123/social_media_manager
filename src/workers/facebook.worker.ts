import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlatformServiceFactory } from '../platforms/platform-service.factory';
import { BasePlatformWorker } from './base/base.worker';
import { RedisService } from 'src/redis/redis.service';
import { SchedulerService } from 'src/scheduler/scheduler.service';
import { SocialIntegrationService } from 'src/social-integration/social-integration.service';

@Injectable()
export class FacebookWorker extends BasePlatformWorker {
  protected readonly queueName = 'facebook:queue';
  protected readonly concurrency = 5;

  constructor(
    private readonly platformServiceFactory: PlatformServiceFactory,
    private readonly schedulerService: SchedulerService,
    private readonly socialIntegrationService: SocialIntegrationService,
    redisService: RedisService, 
  ) {
    super(FacebookWorker.name, redisService);
  }

  protected async processJob(job: Job): Promise<void> {
    const { postId, content, mediaUrls, socialAccountId } = job.data;

    try {
      this.logger.log(`Processing Facebook post: ${postId}`);

      // 1. Get access token
      const accessToken = await this.socialIntegrationService.getValidAccessToken(socialAccountId);

      // 2. Get Facebook platform service
      const platformService = this.platformServiceFactory.getService('facebook');

      // 3. Publish post
      const result = await platformService.publishPost({
        accessToken,
        caption: content,
        mediaUrls,
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error while publishing to Facebook');
      }

      // 4. Confirm success
      await this.schedulerService.handlePlatformConfirmation({
        postId,
        status: 'published',
        platformPostId: result.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Facebook post ${postId} published successfully (FB ID: ${result.id})`);

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
    return 30; // Facebook allows ~30 posts/min per page
  }


}