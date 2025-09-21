import { Controller } from '@nestjs/common';
import { AuditService } from './audit.service';

import { Controller, Get, Query, Delete } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditFilter } from './audit.types';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getAuditLogs(
    @Query() filters: AuditFilter,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50
  ) {
    return this.auditService.getAuditLogs(filters, page, limit);
  }

  @Get('stats')
  async getAuditStats(
    @Query('organizationId') organizationId?: string,
    @Query('days') days: number = 30
  ) {
    return this.auditService.getAuditStats(organizationId, days);
  }

  @Get('export')
  async exportAuditLogs(
    @Query() filters: AuditFilter,
    @Query('format') format: 'csv' | 'json' = 'csv'
  ) {
    const data = await this.auditService.exportAuditLogs(filters, format);
    
    return {
      data,
      format,
      generatedAt: new Date(),
      recordCount: data.split('\n').length - 1 // Approximate count for CSV
    };
  }

  @Delete('cleanup')
  async cleanupOldLogs(@Query('days') days: number = 365) {
    const count = await this.auditService.cleanupOldLogs(days);
    return { 
      message: `Cleaned up ${count} audit logs older than ${days} days`,
      count 
    };
  }
}