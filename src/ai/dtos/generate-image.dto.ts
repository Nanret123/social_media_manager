// src/ai/dtos/generate-image.dto.ts
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Platform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateImageDto {
  @ApiProperty({
    description: 'The prompt or idea for the AI to generate an image',
    example: 'A futuristic city skyline at sunset',
  })
  @IsString()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Target platform for which the image is intended',
    enum: Platform,
    example: Platform.INSTAGRAM,
  })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({
    description: 'Visual style for the AI image',
    example: 'photorealistic',
    enum: ['photorealistic', 'illustration', '3d'],
  })
  @IsOptional()
  @IsString()
  style?: string;

  @ApiPropertyOptional({
    description: 'Aspect ratio of the generated image',
    example: '1:1',
    enum: ['1:1', '16:9', '4:5'],
  })
  @IsOptional()
  @IsString()
  aspectRatio?: string;
}
