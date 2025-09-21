import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { ReportService } from '../modules/reporting/report.service';
import { ExportService } from '../modules/reporting/export.service';
import { NotificationService } from '../modules/notification/notification.service';

@Injectable()
export class ReportGenerationWorker extends BaseWorker {
  protected readonly queueName = 'report-generation';
  protected readonly concurrency = 2; // Resource-intensive, limit concurrency

  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
    private readonly notificationService: NotificationService,
  ) {
    super('ReportGenerationWorker');
  }

  protected async processJob(job: Job): Promise<void> {
    const { reportId, organizationId, userId, request } = job.data;

    try {
      this.logger.log(`Processing report generation for report ${reportId}`);

      // Update status to processing
      await this.reportService.updateReportStatus(reportId, 'PROCESSING');

      // Generate report data
      const reportData = await this.reportService.generateReportData(reportId, request);

      // Export to requested format
      const exportResult = await this.exportService.exportReport(reportData, request.format, {
        includeCharts: request.includeCharts,
        compression: true,
      });

      // Update report with results
      await this.reportService.completeReport(reportId, {
        data: reportData,
        fileUrl: exportResult.fileUrl,
        fileSize: exportResult.fileSize,
      });

      // Send success notification
      await this.notificationService.notifyUser(userId, {
        type: 'REPORT_COMPLETED',
        message: `Your report "${request.title}" is ready!`,
        reportId: reportId,
        fileUrl: exportResult.fileUrl,
      });

      this.logger.log(`Report ${reportId} generated successfully`);

    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error);

      // Update report with error
      await this.reportService.failReport(reportId, error.message);

      // Send error notification
      await this.notificationService.notifyUser(userId, {
        type: 'REPORT_FAILED',
        message: `Failed to generate report "${request.title}": ${error.message}`,
        reportId: reportId,
      });

      throw error; // Let BullMQ handle retries
    }
  }

  protected getRateLimit(): number {
    // Report generation is resource-intensive, limit to 5 per minute
    return 5;
  }

  protected onJobCompleted(job: Job): void {
    const { reportId } = job.data;
    this.logger.log(`Report generation ${reportId} completed successfully`);
  }

  protected onJobFailed(job: Job, error: Error): void {
    const { reportId } = job.data;
    this.logger.error(`Report generation ${reportId} failed:`, error.message);
  }
}