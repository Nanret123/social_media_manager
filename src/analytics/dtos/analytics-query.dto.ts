// src/analytics/dtos/analytics-query.dto.ts
import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { Platform } from '@prisma/client';
import { Type } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 100;
}

