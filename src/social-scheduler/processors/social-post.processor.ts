import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SocialSchedulerService } from '../social-scheduler.service';


@Processor('social-posting')
export class SocialPostProcessor extends WorkerHost {
  private readonly logger = new Logger(SocialPostProcessor.name);

  constructor(private readonly schedulerService: SocialSchedulerService) {
    super();
  }

  // ✅ This runs whenever a job is processed
  async process(job: Job<{ postId: string; retryCount?: number }>): Promise<void> {
    this.logger.log(`Processing job ${job.id} for post ${job.data.postId}`);
    await this.schedulerService.processScheduledPost(job.data);
  }

  // Optional event listeners
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`❌ Job ${job?.id} failed: ${err.message}`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} stalled and will be retried`);
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Worker error: ${err.message}`);
  }
}
