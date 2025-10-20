import { PostsService } from '../posts/posts.service';
// src/scheduling/queue.processor.ts
import {
  Processor,
  Process,
  OnQueueFailed,
  OnQueueCompleted,
  OnQueueActive,
  OnQueueStalled,
  OnQueueWaiting,
} from '@nestjs/bull';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PostingResult } from 'src/post-publishing/interfaces/platform-client.interface';
import { SchedulingService } from './scheduling.service';

@Injectable()
@Processor('post-scheduling')
export class PostQueueProcessor {
  private readonly logger = new Logger(PostQueueProcessor.name);

  constructor(
    private readonly postsService: PostsService,
  ) {}

  @Process('publish-post')
  async handlePublishJob(job: Job<{ postId: string, organizationId: string }>) {
    const { postId, organizationId } = job.data;

    this.logger.log(`🎯 Processing scheduled post ${postId}`, {
      jobId: job.id,
      attempts: job.attemptsMade,
    });

    try {
      // Use the orchestration service to handle the complete publishing flow
      const result = await this.postsService.executePublish(organizationId, postId);

      this.logger.log(`✅ Successfully published post ${postId}`, {
        platformPostId: result.platformPostId,
      });

      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to publish post ${postId}:`, {
        error: error.message,
        stack: error.stack,
        attempts: job.attemptsMade,
      });

      // Check if we should retry based on error type
      if (this.shouldRetry(error)) {
        this.logger.warn(`🔄 Retrying post ${postId} due to retryable error`);
        throw error; // Let BullMQ handle the retry
      } else {
        // Non-retryable error - mark as failed immediately
        this.logger.error(`💥 Post ${postId} failed with non-retryable error`, {
          error: error.message,
        });

        // The orchestration service already handles status updates in markPostAsFailed
        // We just need to prevent further retries
        await job.discard();
        return { success: false, error: error.message };
      }
    }
  }

  @OnQueueActive()
  async onJobActive(job: Job<{ postId: string }>) {
    this.logger.debug(`🚀 Job started: ${job.id} for post ${job.data.postId}`);
  }

  @OnQueueCompleted()
  async onJobCompleted(job: Job<{ postId: string }>, result: PostingResult) {
    this.logger.log(`🎉 Job completed successfully: ${job.id}`, {
      postId: job.data.postId,
      platformPostId: result.platformPostId,
      duration: job.processedOn - job.timestamp,
    });

    // Clean up job data if needed
    await job.remove();
  }

  @OnQueueFailed()
  async onJobFailed(job: Job<{ postId: string }>, error: Error) {
    const { postId } = job.data;

    this.logger.error(`💥 Job failed: ${job.id}`, {
      postId,
      attempts: job.attemptsMade,
      error: error.message,
      maxAttempts: job.opts.attempts,
    });

    // Final failure handling after all retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      this.logger.error(
        `🛑 Post ${postId} failed after ${job.attemptsMade} attempts`,
        {
          finalError: error.message,
        },
      );

      // The orchestration service's markPostAsFailed will handle the final status update
      // since executePublish already calls it in the catch block

      // Optional: Notify administrators or trigger alerts
      await this.notifyPostFailure(postId, error);
    }
  }

  @OnQueueStalled()
  async onJobStalled(job: Job<{ postId: string }>) {
    this.logger.warn(`⚠️ Job stalled: ${job.id} for post ${job.data.postId}`);

    // Attempt to retry the stalled job
    try {
      await job.retry();
    } catch (retryError) {
      this.logger.error(`Failed to retry stalled job ${job.id}:`, retryError);
    }
  }

  @OnQueueWaiting()
  async onJobWaiting(jobId: string | number) {
    this.logger.debug(`⏳ Job waiting: ${jobId}`);
  }

  /**
   * Determine if a job should be retried based on error type
   */
  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'Rate limit exceeded',
      'Network error',
      'Timeout',
      'Temporary',
      'Busy',
      'Queue',
    ];

    const errorMessage = error.message.toLowerCase();

    // Don't retry on authentication errors, invalid content, etc.
    const nonRetryableErrors = [
      'invalid credentials',
      'authentication failed',
      'permission denied',
      'invalid parameter',
      'content rejected',
      'not found',
    ];

    if (nonRetryableErrors.some((msg) => errorMessage.includes(msg))) {
      return false;
    }

    // Retry on rate limits, network issues, etc.
    return retryableErrors.some((msg) =>
      errorMessage.toLowerCase().includes(msg.toLowerCase()),
    );
  }

  /**
   * Notify about post failure (extend this based on your notification system)
   */
  private async notifyPostFailure(postId: string, error: Error): Promise<void> {
    try {
      // Example: Send to Slack, email, or internal notification system
      this.logger.warn(
        `📢 Post failure notification for ${postId}: ${error.message}`,
      );

      // Implement your notification logic here
      // await this.notificationsService.notifyPostFailure(postId, error.message);
    } catch (notificationError) {
      this.logger.error(
        'Failed to send post failure notification:',
        notificationError,
      );
    }
  }
}
