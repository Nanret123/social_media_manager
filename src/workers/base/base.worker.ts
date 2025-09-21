import { Logger } from '@nestjs/common';
import { Job, Worker} from 'bullmq';
import { RedisService } from 'src/redis/redis.service';

export abstract class BasePlatformWorker {
  protected worker: Worker;
  protected readonly logger: Logger;

  // child workers must set these
  protected abstract readonly queueName: string;
  protected abstract readonly concurrency: number;
  protected readonly redisService: RedisService;

  constructor(
    workerName: string,
    redisService: RedisService,
  ) {
    this.logger = new Logger(workerName);
    this.redisService = redisService;
  }

  initialize(): void {
    const connection = this.redisService.getClient();

    this.worker = new Worker(
      this.queueName,
      async (job: Job) => this.processJob(job),
      {
        connection,
        concurrency: this.concurrency,
        limiter: {
          max: this.getRateLimit(),
          duration: 60_000, // 1 minute
        },
      },
    );

    this.setupEventHandlers();
  }

  protected abstract processJob(job: Job): Promise<void>;

  protected setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
      this.onJobCompleted(job);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed:`, error.message);
      this.onJobFailed(job, error);
    });

    this.worker.on('error', (error) => {
      this.logger.error('Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled`);
    });
  }

  protected onJobCompleted(job: Job): void {
    // Can be overridden by subclasses
  }

  protected onJobFailed(job: Job, error: Error): void {
    // Can be overridden by subclasses
  }

  protected getRateLimit(): number {
    // Default rate limit (jobs per minute)
    return 30;
  }

  async close(): Promise<void> {
    await this.worker.close();
    this.logger.log('Worker closed gracefully');
  }
}
