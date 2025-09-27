// src/scheduling/queue.processor.ts
import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from 'src/rate-limit/rate-limit.service';
import { SchedulePostData } from './scheduling.service';
import { PostingResult } from 'src/social-posting/interfaces/platform-client.interface';
import { SocialPostingService } from 'src/social-posting/social-posting.service';

@Injectable()
@Processor('post-scheduling')
export class PostQueueProcessor {
  private readonly logger = new Logger(PostQueueProcessor.name);

  constructor(
    private readonly socialPostingService: SocialPostingService,
    private readonly prisma: PrismaService,
    private readonly rateLimitService: RateLimitService, // Assume this service exists
  ) {}

    @Process('publish-post')
  async handlePublishJob(job: Job<SchedulePostData>) {
    const { postId, organizationId, platform, accountId, content, mediaFileIds, options } = job.data;

    this.logger.log(`Processing post ${postId} for publishing`);

    try {
      // Update post status to publishing
      await this.prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHING' },
      });

      // Check rate limits
      const canPublish = await this.rateLimitService.checkLimit(
        platform,
        accountId,
        'publish'
      );

      if (!canPublish) {
        // Reschedule for later
        const retryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes later
        await job.moveToDelayed(retryTime.getTime() - Date.now());
        this.logger.warn(`Rate limit hit for ${platform}, rescheduling post ${postId}`);
        return;
      }

      // Publish using the social posting service
      const result = await this.socialPostingService.publishPost(organizationId, {
        platform,
        accountId,
        content,
        mediaFileIds,
        options,
      });

      if (result.success) {
        // Success - update post status
        await this.prisma.post.update({
          where: { id: postId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            platformPostId: result.platformPostId,
            errorMessage: null,
          },
        });
        
        this.logger.log(`✅ Successfully published post ${postId}`);
      } else {
        // Platform returned error
        throw new Error(result.error || 'Platform publishing failed');
      }

      return result;
      
    } catch (error) {
      this.logger.error(`Failed to publish post ${postId}:`, error);
      
      // Update post as failed
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      // Rethrow for BullMQ retry logic
      throw error;
    }
  }

  @OnQueueFailed()
  async onJobFailed(job: Job<SchedulePostData>, error: Error) {
    this.logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, error);
    
    // Final failure handling after all retries
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      await this.prisma.post.update({
        where: { id: job.data.postId },
        data: {
          status: 'FAILED',
          errorMessage: `Failed after ${job.attemptsMade} attempts: ${error.message}`,
        },
      });
    }
  }

  @OnQueueCompleted()
  async onJobCompleted(job: Job<SchedulePostData>, result: PostingResult) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }
}