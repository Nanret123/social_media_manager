import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class GenerateHashtagsDto {
  @ApiProperty({
    description: 'The platform where the content will be posted',
    enum: Platform,
    example: Platform.INSTAGRAM,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    description: 'The content for which hashtags should be generated',
    example: '10 tips to improve your productivity in 2025',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'The industry related to the content (optional)',
    example: 'Technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({
    description:
      'Whether to include niche hashtags in addition to popular ones',
    example: true,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeNiche?: boolean = false;

  @ApiProperty({
    description: 'Number of hashtags to generate',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number = 10;
}
