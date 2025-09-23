// src/ai/dtos/generate-image.dto.ts
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Platform } from '@prisma/client';

export class GenerateImageDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsString()
  style?: string; // 'photorealistic', 'illustration', '3d'
}