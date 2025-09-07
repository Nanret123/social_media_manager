import { ApiProperty } from '@nestjs/swagger';
import { ContentType, Platform, ToneType } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class GenerateCaptionDto {
  @ApiProperty({
    description: 'The ID of the organization generating the caption',
    example: 'f4d2a6e1-9c43-4a2b-9c52-3db92ab5b111',
  })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'The platform where the caption will be posted',
    enum: Platform,
    example: Platform.INSTAGRAM,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    description: 'The tone in which the caption should be generated',
    enum: ToneType,
    example: ToneType.INSPIRATIONAL,
  })
  @IsEnum(ToneType)
  tone: ToneType;

  @ApiProperty({
    description: 'Optional URL of an image to provide context for the caption',
    example: 'https://example.com/images/product.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({
    description: 'Optional existing content to improve',
    example: 'Our new product is here, check it out!',
    required: false,
  })
  @IsOptional()
  @IsString()
  existingContent?: string;

  @ApiProperty({
    description: 'Additional context to guide caption generation',
    example: 'Highlight the eco-friendly aspect of the product.',
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    description: 'Whether to include hashtags in the response',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeHashtags?: boolean = true;

  @ApiProperty({
    enum: ContentType,
    description: 'The type of content to generate',
    example: ContentType.POST,
  })
  @IsEnum(ContentType)
  contentType: ContentType;
}
