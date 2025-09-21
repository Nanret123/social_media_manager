import { Injectable } from '@nestjs/common';

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditLog, AuditFilter, AuditStats } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(event: {
    organizationId?: string;
    userId: string;
    userEmail: string;
    userRole: string;
    action: string;
    resource: string;
    resourceId?: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: event.organizationId,
          userId: event.userId,
          userEmail: event.userEmail,
          userRole: event.userRole,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          description: event.description,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: event.metadata,
          status: event.status,
          error: event.error,
        },
      });
    } catch (error) {
      // Don't throw error from audit logging to avoid breaking main functionality
      this.logger.error('Failed to log audit event:', error);
    }
  }

  async getAuditLogs(filters: AuditFilter, page: number = 1, limit: number = 50): Promise<{ logs: AuditLog[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: { name: true },
          },
          user: {
            select: { name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        organization: {
          select: { name: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }

  async getAuditStats(organizationId?: string, days: number = 30): Promise<AuditStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = organizationId ? { organizationId, createdAt: { gte: startDate } } : { createdAt: { gte: startDate } };

    const [
      totalActions,
      successfulActions,
      failedActions,
      topUsers,
      topActions,
      dailyActivity,
    ] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({ where: { ...where, status: 'SUCCESS' } }),
      this.prisma.auditLog.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.auditLog.groupBy({
        by: ['userId', 'userEmail'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['createdAt'],
        where,
        _count: { id: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      totalActions,
      successfulActions,
      failedActions,
      topUsers: topUsers.map(user => ({
        userId: user.userId,
        email: user.userEmail,
        count: user._count.id,
      })),
      topActions: topActions.map(action => ({
        action: action.action as any,
        count: action._count.id,
      })),
      dailyActivity: dailyActivity.map(day => ({
        date: day.createdAt.toISOString().split('T')[0],
        count: day._count.id,
      })),
    };
  }

  async exportAuditLogs(filters: AuditFilter, format: 'csv' | 'json'): Promise<string> {
    const where = this.buildWhereClause(filters);
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: { name: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (format === 'csv') {
      return this.convertToCSV(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  async cleanupOldLogs(maxAgeDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${maxAgeDays} days`);
    return result.count;
  }

  private buildWhereClause(filters: AuditFilter): any {
    const where: any = {};

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.resource) {
      where.resource = filters.resource;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { userEmail: { contains: filters.search, mode: 'insensitive' } },
        { resourceId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = ['Timestamp', 'User', 'Email', 'Action', 'Resource', 'Description', 'Status', 'IP Address'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.user?.name || 'Unknown',
      log.userEmail,
      log.action,
      log.resource,
      `"${log.description.replace(/"/g, '""')}"`,
      log.status,
      log.ipAddress,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}