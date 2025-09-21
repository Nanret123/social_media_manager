import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlatformServiceFactory } from 'src/platforms/platform-service.factory';
import { BasePlatformWorker } from './base/base.worker';
import { SchedulerService } from 'src/scheduler/scheduler.service';
import { RedisService } from 'src/redis/redis.service';
import { SocialIntegrationService } from 'src/social-integration/social-integration.service';

@Injectable()
export class TwitterWorker extends BasePlatformWorker {
  protected readonly queueName = 'twitter:queue';
  protected readonly concurrency = 1;

  constructor(
    private readonly platformServiceFactory: PlatformServiceFactory,
    private readonly schedulerService: SchedulerService,
    private readonly socialIntegrationService: SocialIntegrationService,
    redisService: RedisService,
  ) {
    super(TwitterWorker.name, redisService);
  }

  protected async processJob(job: Job): Promise<void> {
    const { postId, content, mediaUrls, socialAccountId, organizationId } =
      job.data;

    try {
      this.logger.log(`Processing Twitter post ${postId}`);

      // 1. Get access token
      const accessToken =
        await this.socialIntegrationService.getValidAccessToken(
          socialAccountId,
        );

      // 2. Get Facebook platform service
      const platformService = this.platformServiceFactory.getService('twitter');

      // Publish to Twitter
      const result = await platformService.publishPost({
        accessToken,
        caption: content,
        mediaUrls,
      });

      if (result.success) {
        // Update scheduler with success
        await this.schedulerService.handlePlatformConfirmation({
          postId,
          status: 'published',
          platformPostId: result.id,
          timestamp: new Date(),
        });

        this.logger.log(
          `Twitter post ${postId} published successfully: ${result.id}`,
        );
      } else {
        throw new Error(result.error || 'Failed to publish to Twitter');
      }
    } catch (error) {
      this.logger.error(`Failed to process Twitter post ${postId}:`, error);

      // Handle Twitter-specific rate limits
      if (
        error.message.includes('rate limit') ||
        error.response?.status === 429
      ) {
        this.logger.warn('Twitter rate limit hit, delaying job');
        await job.moveToDelayed(900000); // 15 minutes
        return;
      }

      // Update scheduler with failure
      await this.schedulerService.handlePlatformConfirmation({
        postId,
        status: 'failed',
        failureReason: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  protected getRateLimit(): number {
    // Twitter: ~1 post per minute per account (very strict)
    return 1;
  }

  private async getAccessToken(socialAccountId: string): Promise<string> {
    // Implement token retrieval logic
    return 'twitter_access_token';
  }

  protected onJobFailed(job: Job, error: Error): void {
    // Twitter-specific failure handling
    if (error.message.includes('rate limit')) {
      const { postId } = job.data;
      this.logger.warn(
        `Twitter rate limit exceeded for post ${postId}, job delayed`,
      );
    }
  }
}
