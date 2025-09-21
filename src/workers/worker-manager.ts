import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { WebhookWorker } from "src/webhook/workers/webhook.worker";
import { FacebookWorker } from "./facebook.worker";
import { LinkedInWorker } from "./linkedin.worker";
import { ReportGenerationWorker } from "./report-generation.worker";
import { TwitterWorker } from "./x.worker";
import { AnalyticsWorker } from "./analytics.worker";

export interface WorkerStatus {
  name: string;
  queue: string;
  isRunning: boolean;
  processed: number;
  failed: number;
  concurrency: number;
  lastActivity?: Date;
}

@Injectable()
export class WorkerManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerManager.name);
  private workers: Map<string, { worker: any; stats: WorkerStats }> = new Map();
  private isShuttingDown = false;

  constructor(
    private readonly linkedinWorker: LinkedInWorker,
    private readonly facebookWorker: FacebookWorker,
    private readonly twitterWorker: TwitterWorker,
    private readonly analyticsWorker: AnalyticsWorker,
    private readonly reportGenerationWorker: ReportGenerationWorker,
    private readonly webhookWorker: WebhookWorker,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeWorkers();
      this.logger.log('All workers initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize workers:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    await this.shutdownWorkers();
  }

  private async initializeWorkers(): Promise<void> {
    const workers = [
      { name: 'LinkedIn', worker: this.linkedinWorker, queue: 'linkedin-posts' },
      { name: 'Facebook', worker: this.facebookWorker, queue: 'facebook-posts' },
      { name: 'Twitter', worker: this.twitterWorker, queue: 'twitter-posts' },
      { name: 'Analytics', worker: this.analyticsWorker, queue: 'analytics-processing' },
      { name: 'ReportGeneration', worker: this.reportGenerationWorker, queue: 'report-generation' },
      { name: 'Webhook', worker: this.webhookWorker, queue: 'webhook-events' },
    ];

    for (const { name, worker, queue } of workers) {
      try {
        worker.initialize();
        this.workers.set(name, {
          worker,
          stats: {
            name,
            queue,
            isRunning: true,
            processed: 0,
            failed: 0,
            concurrency: worker['concurrency'],
            lastActivity: new Date(),
          },
        });

        // Add event listeners for stats tracking
        this.setupWorkerEvents(name, worker);

        this.logger.log(`✓ ${name} worker initialized for queue: ${queue}`);
        
        // Small delay between worker initializations
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`Failed to initialize ${name} worker:`, error);
      }
    }
  }

  private setupWorkerEvents(workerName: string, worker: any): void {
    // Listen to worker events for stats tracking
    worker['worker'].on('completed', (job: any) => {
      const workerStats = this.workers.get(workerName);
      if (workerStats) {
        workerStats.stats.processed++;
        workerStats.stats.lastActivity = new Date();
      }
    });

    worker['worker'].on('failed', (job: any, error: Error) => {
      const workerStats = this.workers.get(workerName);
      if (workerStats) {
        workerStats.stats.failed++;
        workerStats.stats.lastActivity = new Date();
      }
    });

    worker['worker'].on('error', (error: Error) => {
      this.logger.error(`${workerName} worker error:`, error);
    });

    worker['worker'].on('stalled', (jobId: string) => {
      this.logger.warn(`${workerName} worker job stalled: ${jobId}`);
    });
  }

  async shutdownWorkers(): Promise<void> {
    this.logger.log('Shutting down workers...');
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [name, { worker }] of this.workers.entries()) {
      shutdownPromises.push(
        worker.close().then(() => {
          const workerStats = this.workers.get(name);
          if (workerStats) {
            workerStats.stats.isRunning = false;
          }
          this.logger.log(`✓ ${name} worker shut down gracefully`);
        }).catch((error: Error) => {
          this.logger.error(`Failed to shut down ${name} worker:`, error);
        })
      );
    }

    await Promise.all(shutdownPromises);
    this.logger.log('All workers shut down');
  }

  async restartWorker(workerName: string): Promise<boolean> {
    const workerData = this.workers.get(workerName);
    if (!workerData) {
      this.logger.warn(`Worker ${workerName} not found`);
      return false;
    }

    try {
      // Shutdown existing worker
      await workerData.worker.close();
      
      // Re-initialize worker
      workerData.worker.initialize();
      
      // Reset stats
      workerData.stats.isRunning = true;
      workerData.stats.processed = 0;
      workerData.stats.failed = 0;
      workerData.stats.lastActivity = new Date();

      this.logger.log(`✓ ${workerName} worker restarted successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to restart ${workerName} worker:`, error);
      return false;
    }
  }

  async pauseWorker(workerName: string): Promise<boolean> {
    const workerData = this.workers.get(workerName);
    if (!workerData) {
      this.logger.warn(`Worker ${workerName} not found`);
      return false;
    }

    try {
      await workerData.worker.pause();
      workerData.stats.isRunning = false;
      this.logger.log(`✓ ${workerName} worker paused`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause ${workerName} worker:`, error);
      return false;
    }
  }

  async resumeWorker(workerName: string): Promise<boolean> {
    const workerData = this.workers.get(workerName);
    if (!workerData) {
      this.logger.warn(`Worker ${workerName} not found`);
      return false;
    }

    try {
      await workerData.worker.resume();
      workerData.stats.isRunning = true;
      this.logger.log(`✓ ${workerName} worker resumed`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume ${workerName} worker:`, error);
      return false;
    }
  }

  getWorkerStatus(workerName?: string): WorkerStatus | WorkerStatus[] {
    if (workerName) {
      const workerData = this.workers.get(workerName);
      if (!workerData) {
        throw new Error(`Worker ${workerName} not found`);
      }
      return { ...workerData.stats };
    }

    return Array.from(this.workers.values()).map(({ stats }) => ({ ...stats }));
  }

  getActiveWorkersCount(): number {
    return Array.from(this.workers.values()).filter(
      ({ stats }) => stats.isRunning
    ).length;
  }

  getTotalProcessedJobs(): number {
    return Array.from(this.workers.values()).reduce(
      (total, { stats }) => total + stats.processed,
      0
    );
  }

  getTotalFailedJobs(): number {
    return Array.from(this.workers.values()).reduce(
      (total, { stats }) => total + stats.failed,
      0
    );
  }

  async drainAllQueues(): Promise<void> {
    this.logger.log('Draining all worker queues...');
    
    for (const [name, { worker }] of this.workers.entries()) {
      try {
        await worker.drain();
        this.logger.log(`✓ ${name} worker queue drained`);
      } catch (error) {
        this.logger.error(`Failed to drain ${name} worker queue:`, error);
      }
    }
  }

  async getQueueStats(): Promise<QueueStats[]> {
    const queueStats: QueueStats[] = [];
    
    for (const [name, { stats }] of this.workers.entries()) {
      try {
        // You would typically use BullMQ's queue.getJobCounts() here
        // This is a simplified implementation
        queueStats.push({
          name: stats.name,
          queue: stats.queue,
          waiting: 0, // Would come from queue.getJobCounts()
          active: 0,
          completed: stats.processed,
          failed: stats.failed,
          delayed: 0,
        });
      } catch (error) {
        this.logger.error(`Failed to get queue stats for ${name}:`, error);
      }
    }

    return queueStats;
  }

  // Health check method
  async healthCheck(): Promise<HealthCheckResult> {
    const results: HealthCheckResult = {
      timestamp: new Date(),
      totalWorkers: this.workers.size,
      activeWorkers: this.getActiveWorkersCount(),
      totalProcessed: this.getTotalProcessedJobs(),
      totalFailed: this.getTotalFailedJobs(),
      workers: {},
    };

    for (const [name, { stats }] of this.workers.entries()) {
      results.workers[name] = {
        healthy: stats.isRunning,
        processed: stats.processed,
        failed: stats.failed,
        lastActivity: stats.lastActivity,
      };
    }

    return results;
  }
}

// Interface definitions
interface WorkerStats {
  name: string;
  queue: string;
  isRunning: boolean;
  processed: number;
  failed: number;
  concurrency: number;
  lastActivity?: Date;
}

interface QueueStats {
  name: string;
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface HealthCheckResult {
  timestamp: Date;
  totalWorkers: number;
  activeWorkers: number;
  totalProcessed: number;
  totalFailed: number;
  workers: {
    [key: string]: {
      healthy: boolean;
      processed: number;
      failed: number;
      lastActivity?: Date;
    };
  };
}