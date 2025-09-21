import { Job } from 'bullmq';
import { BasePlatformWorker } from './base/base.worker';
import { SchedulerService } from 'src/scheduler/scheduler.service';
import { RedisService } from 'src/redis/redis.service';
import { SocialIntegrationService } from 'src/social-integration/social-integration.service';
import { PlatformServiceFactory } from 'src/platforms/platform-service.factory';

export class InstagramWorker extends BasePlatformWorker {
 protected readonly queueName = 'instagram:queue';
  protected readonly concurrency = 5;

  constructor(
    private readonly platformServiceFactory: PlatformServiceFactory,
        private readonly schedulerService: SchedulerService,
        private readonly socialIntegrationService: SocialIntegrationService,
        redisService: RedisService, 
  ) {
    super(InstagramWorker.name, redisService);
  }

  protected async processJob(job: Job): Promise<void> {
    const { postId, content, mediaUrls, socialAccountId } = job.data;

    try {
      this.logger.log(`Processing Instagram post: ${postId}`);

      // 1. Get access token
      const accessToken = await this.socialIntegrationService.getValidAccessToken(socialAccountId);

      // 2. Get Facebook platform service
      const platformService = this.platformServiceFactory.getService('instagram');

      // 3. Publish post
      const result = await platformService.publishPost({
        accessToken,
        caption: content,
        mediaUrls,
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error while publishing to Instagram');
      }

      // 4. Confirm success
      await this.schedulerService.handlePlatformConfirmation({
        postId,
        status: 'published',
        platformPostId: result.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Instagram post ${postId} published successfully (FB ID: ${result.id})`);

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


  protected isRecoverableError(error: any): boolean {
    // Instagram-specific recoverable errors
    return error.code === 'IG_RATE_LIMIT' || error.code === 'IG_API_TIMEOUT';
  }

  protected getErrorMessage(error: any): string {
    return error.message || 'Instagram API error';
  }
}
