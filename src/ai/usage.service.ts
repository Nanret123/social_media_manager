import { Injectable } from '@nestjs/common';
import { UsageType, Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsageService {
  private readonly PRICING = {
    'gpt-4o-mini': {
      input: 0.00015, // per 1K tokens
      output: 0.0006, // per 1K tokens
    },
    'dall-e-3': {
      standard: 0.04, // per image
      hd: 0.08, // per image
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  calculateContentCost(usage: any): number {
    if (!usage) return 0;

    const pricing = this.PRICING['gpt-4o-mini'];
    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(6));
  }

  calculateImageCost(quality: string): number {
    const pricing = this.PRICING['dall-e-3'];
    return quality === 'hd' ? pricing.hd : pricing.standard;
  }

  async trackAiUsage(data: {
    organizationId: string;
    userId: string;
    type: UsageType;
    platform?: Platform;
    sourceContentId?: string;
    sourceImageId?: string;
    creditsUsed: number;
  }): Promise<void> {
    await this.prisma.aiUsage.create({
      data,
    });
  }

  // Add method to get user's remaining credits/usage
  async getUserUsageStats(userId: string, organizationId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [usage, totalCost] = await Promise.all([
      this.prisma.aiUsage.aggregate({
        where: {
          userId,
          organizationId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { creditsUsed: true },
        _count: true,
      }),
      this.prisma.aiContentGeneration.aggregate({
        where: {
          userId,
          organizationId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { cost: true },
      }),
    ]);

    return {
      creditsUsed: usage._sum.creditsUsed || 0,
      generationsCount: usage._count,
      totalCostThisMonth: totalCost._sum.cost || 0,
    };
  }
}
