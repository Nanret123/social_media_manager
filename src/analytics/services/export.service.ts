// src/analytics/services/export.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export type ExportFormat = 'excel' | 'pdf' | 'csv';

interface ExportOptions {
  format: ExportFormat;
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  platform?: Platform;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Generate analytics report
   */
  async generateReport(options: ExportOptions): Promise<Buffer> {
    switch (options.format) {
      case 'excel':
        return this.generateExcelReport(options);
      case 'pdf':
        return this.generatePdfReport(options);
      case 'csv':
        return this.generateCsvReport(options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  private async generateExcelReport(options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Analytics Report');

    // Add data
    const data = await this.getExportData(options);
    worksheet.addRows(data);

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async generatePdfReport(options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const buffers: any[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Add content to PDF
      doc.fontSize(20).text('Analytics Report', 100, 100);
      // Add more content...

      doc.end();
    });
  }

  private async generateCsvReport(options: ExportOptions): Promise<Buffer> {
    const data = await this.getExportData(options);
    const csv = data.map((row) => row.join(',')).join('\n');
    return Buffer.from(csv);
  }

  private async getExportData(options: ExportOptions): Promise<any[][]> {
    const summary = await this.analyticsService.getOrganizationSummary(
      options.organizationId,
      {
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
        platform: options.platform,
      },
    );

    return [
      ['Metric', 'Value'],
      ['Total Likes', summary.totalLikes],
      ['Total Comments', summary.totalComments],
      ['Total Shares', summary.totalShares],
      ['Total Impressions', summary.totalImpressions],
      ['Total Clicks', summary.totalClicks],
      ['Engagement Rate', `${(summary.engagementRate * 100).toFixed(1)}%`],
      ['Click-Through Rate', `${(summary.clickThroughRate * 100).toFixed(1)}%`],
    ];
  }
}
