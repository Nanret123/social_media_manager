import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TrendingTopicsDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiPropertyOptional({ description: 'Industry for contextual topics' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Region for localized topics' })
  @IsOptional()
  @IsString()
  region?: string;

   @ApiPropertyOptional({ description: 'Number of topics to generate', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number = 10;
}

export class TrendingTopic {
  @ApiProperty()
  topic: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  hashtags: string[];

  @ApiProperty({ type: [String] })
  contentIdeas: string[];
}