import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform, ContentType, TemplateCategory } from '@prisma/client';
import { TemplateContent } from '../templates.service';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Summer Sale Post', description: 'Template name' })
  name: string;

  @ApiPropertyOptional({ example: 'A catchy template for summer discounts' })
  description?: string;

  @ApiProperty({
    enum: Platform,
    example: 'INSTAGRAM',
    description: 'Target platform (e.g., Instagram, Facebook)',
  })
  platform: Platform;

  @ApiProperty({
    enum: ContentType,
    example: 'POST',
    description: 'Type of content (e.g., post, story, tweet)',
  })
  contentType: ContentType;

  @ApiProperty({
    enum: TemplateCategory,
    example: 'PROMOTIONAL',
    description: 'Category of the template',
  })
  category: TemplateCategory;

  @ApiPropertyOptional({
    type: [String],
    example: ['summer', 'discounts'],
    description: 'Tags for easier search and filtering',
  })
  tags?: string[];

  @ApiProperty({
    type: Object,
    description: 'Content structure of the template',
    example: {
      structure: {
        caption: 'Buy {product} now and save {discount}!',
        hashtags: ['#sale', '#summer'],
        cta: 'Shop now at {url}',
      },
      metadata: {
        tone: 'FRIENDLY',
        idealLength: 120,
      },
    },
  })
  content: TemplateContent;

  @ApiPropertyOptional({
    description: 'Set to true to make the template public',
    default: false,
  })
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Associated Brand Kit ID (must belong to the organization)',
  })
  brandKitId?: string;
}
