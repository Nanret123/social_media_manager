import { ApiProperty } from '@nestjs/swagger';
import { ContentType, Platform } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Social account to publish under' })
  @IsString()
  socialAccountId: string;

  @ApiProperty({ description: 'Main content of the post' })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Media file IDs already uploaded',
    required: false,
  })
  @IsOptional()
  @IsArray()
  mediaFileIds?: string[];

  @ApiProperty({
    description: 'AI content ID if generated via AI',
    required: false,
  })
  @IsOptional()
  @IsString()
  aiContentId?: string;
  @ApiProperty({
    enum: Platform,
    description: 'Platform to publish on',
    example: Platform.FACEBOOK,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    enum: ContentType,
    description: 'Content type (text, image, video, etc.)',
    example: ContentType.POST,
  })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty({
    description: 'Extra metadata like hashtags, mentions',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Scheduled time for the post', required: false, example: "2025-10-21T14:30:00.000" })
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({
    description: 'Timezone of the scheduled time',
    example: 'Africa/Lagos',
  })
  @IsString()
   timezone: string;
}
