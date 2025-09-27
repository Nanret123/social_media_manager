import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsSummary {
  @ApiProperty({ description: 'Total likes' })
  totalLikes: number;

  @ApiProperty({ description: 'Total comments' })
  totalComments: number;

  @ApiProperty({ description: 'Total shares' })
  totalShares: number;

  @ApiProperty({ description: 'Total impressions' })
  totalImpressions: number;

  @ApiProperty({ description: 'Total clicks' })
  totalClicks: number;

  @ApiProperty({ description: 'Engagement rate as a fraction' })
  engagementRate: number;

  @ApiProperty({ description: 'Click-through rate as a fraction' })
  clickThroughRate: number;
}
