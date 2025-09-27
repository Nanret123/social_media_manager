import { ApiPropertyOptional } from '@nestjs/swagger';
import { Platform, ContentType, TemplateCategory, TemplateStatus } from '@prisma/client';
import { TemplateContent } from '../templates.service';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'New template name' })
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  description?: string;

  @ApiPropertyOptional({ enum: Platform, description: 'Target platform' })
  platform?: Platform;

  @ApiPropertyOptional({ enum: ContentType, description: 'Type of content' })
  contentType?: ContentType;

  @ApiPropertyOptional({ enum: TemplateCategory, description: 'Template category' })
  category?: TemplateCategory;

  @ApiPropertyOptional({ type: [String], description: 'Updated tags' })
  tags?: string[];

  @ApiPropertyOptional({ type: Object, description: 'Updated content structure' })
  content?: TemplateContent;

  @ApiPropertyOptional({ enum: TemplateStatus, description: 'Template status' })
  status?: TemplateStatus;

  @ApiPropertyOptional({ description: 'Change associated brand kit' })
  brandKitId?: string;
}
