// src/analytics/controllers/analytics.controller.ts
import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { AnalyticsQueryDto } from './dtos/analytics-query.dto';
import { AiInsightsService } from './services/ai-insights.service';
import { AnalyticsService } from './services/analytics.service';


@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly aiInsightsService: AiInsightsService,
  ) {}

  @Get('summary/:organizationId')
  async getSummary(
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOrganizationSummary(organizationId, query);
  }

  @Get('platforms/:organizationId')
  async getPlatformPerformance(
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPlatformPerformance(organizationId, query);
  }

  @Get('timeline/:organizationId')
  async getTimeline(
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTimeSeriesData(organizationId, query);
  }

  @Get('insights/:organizationId')
  async getInsights(@Param('organizationId') organizationId: string) {
    return this.aiInsightsService.generateInsights(organizationId);
  }

  @Get('topposts/:organizationId')
  async getTopPosts(
    @Param('organizationId') organizationId: string,
    @Query() query: AnalyticsQueryDto & { metric?: string },
  ) {
    return this.analyticsService.getTopPosts(organizationId, query, query.metric as any);
  }
}