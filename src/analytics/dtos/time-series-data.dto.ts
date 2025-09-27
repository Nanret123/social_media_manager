import { ApiProperty } from '@nestjs/swagger';
import { AnalyticsSummary } from './analytics-summary.dto';

export class TimeSeriesData{
  @ApiProperty({ type: String, description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ type: AnalyticsSummary, description: 'Analytics metrics for the date' })
  metrics: AnalyticsSummary;
}
