import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

export class TrackUsageDto {
  @ApiProperty({ description: 'Organization ID to track usage for' })
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Tokens consumed during operation' })
  @IsNumber()
  tokens: number;

  @ApiProperty({ description: 'Cost of the operation in USD' })
  @IsNumber()
  cost: number;

  @ApiProperty({ description: 'Type of operation (content/image/insight)' })
  @IsString()
  type: string;
}

export class UsageStatsDto {
  @ApiProperty({ description: 'Organization ID to fetch usage stats for' })
  @IsString()
  organizationId: string;
}
