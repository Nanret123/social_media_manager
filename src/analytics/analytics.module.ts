import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AiInsightsService } from './services/ai-insights.service';
import { AnalyticsService } from './services/analytics.service';
import { ExportService } from './services/export.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AiInsightsService, ExportService],
})
export class AnalyticsModule {}
