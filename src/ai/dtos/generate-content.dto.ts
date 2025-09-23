// src/ai/dtos/generate-content.dto.ts
import { IsEnum, IsString, IsOptional, IsArray } from 'class-validator';
import { Platform, ContentType, ToneType } from '@prisma/client';

export class GenerateContentDto {
  @IsEnum(Platform)
  platform: Platform;

  @IsEnum(ContentType)
  contentType: ContentType;

  @IsString()
  topic: string;

  @IsEnum(ToneType)
  tone: ToneType;

  @IsOptional()
  @IsString()
  customPrompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

