import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID, IsBoolean } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Organization ID this post belongs to' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'User ID creating the post' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Social account to publish under' })
  @IsUUID()
  socialAccountId: string;

  @ApiProperty({ description: 'Main content of the post' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Media URLs', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @ApiProperty({ description: 'Media file IDs already uploaded', required: false })
  @IsOptional()
  @IsArray()
  mediaFileIds?: string[];

  @ApiProperty({ description: 'Whether post requires approval workflow', default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty({ description: 'AI content ID if generated via AI', required: false })
  @IsOptional()
  @IsUUID()
  aiContentId?: string;

  @ApiProperty({ description: 'Platform (facebook, instagram, x, linkedin)' })
  @IsString()
  platform: string;

  @ApiProperty({ description: 'Content type (post, story, reel, etc.)' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'Extra metadata like hashtags, mentions', required: false })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Scheduled time for the post', required: false })
  @IsOptional()
  scheduledAt?: Date;

  @ApiProperty({ description: 'Flag to publish immediately without scheduling', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean; // internal use only
}
