import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { PlatformServiceFactory } from '../platforms/platform-service.factory';

@Injectable()
export class AnalyticsWorker extends BaseWorker {
  protected readonly queueName = 'analytics-processing';
  protected readonly concurrency = 3;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly platformServiceFactory: PlatformServiceFactory,
  ) {
    super('AnalyticsWorker');
  }

  protected async processJob(job: Job): Promise<void> {
    const { type, data } = job.data;

    try {
      this.logger.log(`Processing analytics job: ${type}`);

      switch (type) {
        case 'UPDATE_POST_METRICS':
          await this.updatePostMetrics(data);
          break;

        case 'SYNC_PLATFORM_ANALYTICS':
          await this.syncPlatformAnalytics(data);
          break;

        case 'CALCULATE_ENGAGEMENT_RATES':
          await this.calculateEngagementRates(data);
          break;

        case 'GENERATE_DAILY_REPORT':
          await this.generateDailyReport(data);
          break;

        default:
          throw new Error(`Unknown analytics job type: ${type}`);
      }

      this.logger.log(`Analytics job ${type} completed successfully`);

    } catch (error) {
      this.logger.error(`Failed to process analytics job ${type}:`, error);
      
      // For analytics jobs, we don't always want to retry immediately
      if (this.shouldRetryAnalyticsJob(type)) {
        throw error; // Let BullMQ handle retry
      }
      
      // For some analytics jobs, just log the error and complete
      this.logger.warn(`Non-critical analytics job ${type} failed, skipping retry`);
    }
  }

  private async updatePostMetrics(data: any): Promise<void> {
    const { postId, platform, platformPostId } = data;
    
    // Get platform service to fetch metrics
    const platformService = this.platformServiceFactory.getService(platform);
    
    // Fetch current metrics from platform API
    const metrics = await this.fetchPlatformMetrics(platformService, platformPostId);
    
    // Update in database
    await this.analyticsService.updatePostMetrics(postId, metrics);
  }

  private async syncPlatformAnalytics(data: any): Promise<void> {
    const { socialAccountId, platform, startDate, endDate } = data;
    
    const platformService = this.platformServiceFactory.getService(platform);
    const accessToken = await this.getAccessToken(socialAccountId);
    
    // Fetch analytics from platform API
    const analyticsData = await platformService.getAnalytics({
      accessToken,
      startDate,
      endDate,
    });

    // Process and store the data
    await this.analyticsService.processPlatformAnalytics(analyticsData);
  }

  private async calculateEngagementRates(data: any): Promise<void> {
    const { organizationId, timeRange } = data;
    
    // Calculate engagement rates for all posts in time range
    await this.analyticsService.calculateEngagementRates(organizationId, timeRange);
  }

  private async generateDailyReport(data: any): Promise<void> {
    const { organizationId, date } = data;
    
    // Generate daily analytics report
    await this.analyticsService.generateDailyReport(organizationId, date);
  }

  private async fetchPlatformMetrics(platformService: any, platformPostId: string): Promise<any> {
    // Implement platform-specific metrics fetching
    // This would use the platform service's analytics methods
    return {};
  }

  private shouldRetryAnalyticsJob(type: string): boolean {
    // Don't retry certain analytics jobs that are time-sensitive
    const nonRetryableJobs = ['GENERATE_DAILY_REPORT', 'CALCULATE_ENGAGEMENT_RATES'];
    return !nonRetryableJobs.includes(type);
  }

  private async getAccessToken(socialAccountId: string): Promise<string> {
    // Implement token retrieval logic
    return 'platform_access_token';
  }
}