import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateFromTemplateDto {
  @ApiProperty({ description: 'Template ID to generate content from' })
  templateId: string;

  @ApiProperty({
    type: Object,
    description: 'Variables to replace in the template',
    example: {
      product: 'Sneakers',
      discount: '20%',
      url: 'https://shop.com',
    },
  })
  variables: Record<string, any>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Additional options for generation',
    example: {
      includeHashtags: true,
      includeCTA: true,
      enhanceWithAI: true,
      tone: 'FRIENDLY',
    },
  })
  options?: {
    includeHashtags?: boolean;
    includeCTA?: boolean;
    enhanceWithAI?: boolean;
    tone?: string;
  };
}
