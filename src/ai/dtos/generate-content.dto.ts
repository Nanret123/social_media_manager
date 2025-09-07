import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform, ContentType, ToneType } from '@prisma/client';
import { IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateContentDto {
  @ApiProperty({
    enum: Platform,
    description: 'The platform where the content will be posted',
    example: Platform.X,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    enum: ContentType,
    description: 'The type of content to generate',
    example: ContentType.POST,
  })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty({
    description: 'The main topic of the content',
    example: '10 tips for better productivity',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    enum: ToneType,
    description: 'The tone of the generated content',
    example: ToneType.PROFESSIONAL,
  })
  @IsEnum(ToneType)
  tone: ToneType;

  @ApiPropertyOptional({
    description: 'Whether to include hashtags in the generated content',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeHashtags?: boolean = true;

  @ApiProperty({
    description: 'The ID of the organization requesting the content generation',
    example: 'org_1234567890abcdef',
  })
  @IsString()
  organizationId: string;
}
