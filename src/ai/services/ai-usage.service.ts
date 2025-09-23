// src/ai/services/ai-usage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

interface TrackUsageParams {
  organizationId: string;
  userId: string;
  type: string;
  tokensUsed: number;
  cost: number;
  metadata?: any;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackUsage(params: TrackUsageParams) {
    try {
      await this.prisma.aIUsage.create({
        data: {
          organizationId: params.organizationId,
          userId: params.userId,
          type: params.type,
          tokensUsed: params.tokensUsed,
          cost: params.cost,
          metadata: params.metadata,
        },
      });

      // Update organization's monthly usage (could be cached in Redis)
      await this.updateMonthlyUsage(params.organizationId, params.cost);

    } catch (error) {
      this.logger.error('Failed to track AI usage:', error);
      // Don't throw - usage tracking shouldn't break the main functionality
    }
  }

  async getMonthlyUsage(organizationId: string): Promise<{ cost: number; tokens: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aIUsage.groupBy({
      by: ['organizationId'],
      where: {
        organizationId,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        cost: true,
        tokensUsed: true,
      },
    });

    return {
      cost: usage[0]?._sum.cost || 0,
      tokens: usage[0]?._sum.tokensUsed || 0,
    };
  }

  private async updateMonthlyUsage(organizationId: string, cost: number) {
    // Could implement Redis caching for frequent updates
    // For now, we just log - you can add Redis later
    this.logger.debug(`Organization ${organizationId} AI cost increased by $${cost}`);
  }
}