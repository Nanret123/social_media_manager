// src/analytics/services/analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PostAnalytics } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyticsQueryDto } from '../dtos/analytics-query.dto';
import {
  AnalyticsSummary,
  PlatformPerformance,
  TimeSeriesData,
} from '../dtos/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get analytics summary for an organization
   */
  async getOrganizationSummary(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsSummary> {
    const where = this.buildWhereClause(organizationId, query);

    const result = await this.prisma.postAnalytics.aggregate({
      where,
      _sum: {
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        clicks: true,
        videoViews: true,
        saves: true,
      },
    });

    const sums = result[0]?._sum || {};

    return {
      totalLikes: sums.likes || 0,
      totalComments: sums.comments || 0,
      totalShares: sums.shares || 0,
      totalImpressions: sums.impressions || 0,
      totalClicks: sums.clicks || 0,
      engagementRate: this.calculateEngagementRate(sums),
      clickThroughRate: this.calculateClickThroughRate(sums),
    };
  }

  /**
   * Get platform comparison data
   */
  async getPlatformPerformance(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<PlatformPerformance[]> {
    const platforms = await this.prisma.postAnalytics.groupBy({
      by: ['platform'],
      where: this.buildWhereClause(organizationId, query),
      _sum: {
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        clicks: true,
      },
    });

    const totalMetrics = await this.getOrganizationSummary(
      organizationId,
      query,
    );

    return platforms.map((platform) => ({
      platform: platform.platform,
      metrics: {
        totalLikes: platform._sum.likes || 0,
        totalComments: platform._sum.comments || 0,
        totalShares: platform._sum.shares || 0,
        totalImpressions: platform._sum.impressions || 0,
        totalClicks: platform._sum.clicks || 0,
        engagementRate: this.calculateEngagementRate(platform._sum),
        clickThroughRate: this.calculateClickThroughRate(platform._sum),
      },
      percentageChange: this.calculatePlatformPercentage(
        platform,
        totalMetrics,
      ),
    }));
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<TimeSeriesData[]> {
    const results = await this.prisma.postAnalytics.groupBy({
      by: ['createdAt'],
      where: this.buildWhereClause(organizationId, query),
      _sum: {
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        clicks: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return results.map((result) => ({
      date: result.createdAt.toISOString().split('T')[0],
      metrics: {
        totalLikes: result._sum.likes || 0,
        totalComments: result._sum.comments || 0,
        totalShares: result._sum.shares || 0,
        totalImpressions: result._sum.impressions || 0,
        totalClicks: result._sum.clicks || 0,
        engagementRate: this.calculateEngagementRate(result._sum),
        clickThroughRate: this.calculateClickThroughRate(result._sum),
      },
    }));
  }

  /**
   * Get top performing posts
   */
  async getTopPosts(
    organizationId: string,
    query: AnalyticsQueryDto,
    metric: keyof PostAnalytics = 'likes',
  ) {
    return this.prisma.postAnalytics.findMany({
      where: this.buildWhereClause(organizationId, query),
      orderBy: { [metric]: 'desc' },
      take: query.limit,
      include: {
        post: {
          select: {
            id: true,
            content: true,
            scheduledAt: true,
          },
        },
      },
    });
  }

  /**
   * Build Prisma where clause from query parameters
   */
  private buildWhereClause(organizationId: string, query: AnalyticsQueryDto) {
    return {
      organizationId,
      platform: query.platform,
      postId: query.postId,
      createdAt: {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined,
      },
    };
  }

  /**
   * Calculate engagement rate: (likes + comments + shares) / impressions
   */
  private calculateEngagementRate(sums: any): number {
    const engagements =
      (sums.likes || 0) + (sums.comments || 0) + (sums.shares || 0);
    const impressions = sums.impressions || 1; // Avoid division by zero

    return impressions > 0 ? engagements / impressions : 0;
  }

  /**
   * Calculate click-through rate: clicks / impressions
   */
  private calculateClickThroughRate(sums: any): number {
    const clicks = sums.clicks || 0;
    const impressions = sums.impressions || 1;

    return impressions > 0 ? clicks / impressions : 0;
  }

  /**
   * Calculate platform percentage of total
   */
  private calculatePlatformPercentage(
    platform: any,
    total: AnalyticsSummary,
  ): number {
    const platformEngagements =
      (platform._sum.likes || 0) +
      (platform._sum.comments || 0) +
      (platform._sum.shares || 0);
    const totalEngagements =
      total.totalLikes + total.totalComments + total.totalShares;

    return totalEngagements > 0 ? platformEngagements / totalEngagements : 0;
  }
}
