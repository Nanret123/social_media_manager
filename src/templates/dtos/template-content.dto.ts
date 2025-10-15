import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  Max,
  IsUrl,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VariableValidationDto {
  @ApiPropertyOptional({ description: 'Minimum length of the variable value' })
  @IsOptional()
  @IsInt()
  minLength?: number;

  @ApiPropertyOptional({ description: 'Maximum length of the variable value' })
  @IsOptional()
  @IsInt()
  maxLength?: number;

  @ApiPropertyOptional({
    description: 'Regex pattern for validation',
    example: '^[A-Za-z0-9]+$',
  })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({
    description: 'Allowed options (for select-like fields)',
    example: ['LOW', 'MEDIUM', 'HIGH'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class TemplateVariableDto {
  @ApiProperty({
    description: 'Data type of the variable',
    enum: ['string', 'number', 'boolean', 'date', 'url'],
    example: 'string',
  })
  @IsString()
  @IsIn(['string', 'number', 'boolean', 'date', 'url'])
  type: 'string' | 'number' | 'boolean' | 'date' | 'url';

  @ApiProperty({
    description: 'Whether this variable is required',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ description: 'Default value for the variable' })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Description of what this variable represents',
    example: 'Discount percentage for the offer',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: VariableValidationDto,
    description: 'Validation rules for this variable',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariableValidationDto)
  validation?: VariableValidationDto;
}

export class TemplateStructureDto {
  @ApiProperty({
    description: 'The main text or caption of the template',
    example: 'Buy {product} now and save {discount}!',
  })
  @IsString()
  caption: string;

  @ApiPropertyOptional({
    description: 'List of hashtags to include in the post',
    example: ['#sale', '#summer'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({
    description: 'Call to action text',
    example: 'Shop now at {url}',
  })
  @IsOptional()
  @IsString()
  cta?: string;

  @ApiProperty({
    description: 'Variables used inside the template',
    type: Object,
    example: {
      product: {
        type: 'string',
        required: true,
        defaultValue: 'Cool T-Shirt',
        description: 'The product name',
      },
      discount: {
        type: 'number',
        required: true,
        defaultValue: 20, 
        description: 'Discount value',
      },
    },
  })
  @IsObject()
  variables: Record<string, TemplateVariableDto>;
}

export class TemplateMetadataDto {
  @ApiProperty({
    description: 'Ideal content length in characters',
    example: 120,
  })
  @IsInt()
  idealLength: number;

  @ApiProperty({
    description: 'Tone or style of the template',
    example: 'FRIENDLY',
  })
  @IsString()
  tone: string;

  @ApiPropertyOptional({
    description: 'List of emoji recommendations',
    example: ['🔥', '🌴', '💰'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emojiRecommendations?: string[];

  @ApiPropertyOptional({
    description: 'Platform-specific metadata',
    example: {
      instagram: { maxHashtags: 30 },
      twitter: { maxLength: 280 },
    },
  })
  @IsOptional()
  @IsObject()
  platformSpecific?: Record<string, any>;
}

export class TemplateContentDto {
  @ApiProperty({
    description: 'Version of the template content structure',
    example: 1,
  })
  @IsInt()
  version: number;

  @ApiProperty({
    type: TemplateStructureDto,
    description: 'Structure of the template content',
  })
  @ValidateNested()
  @Type(() => TemplateStructureDto)
  structure: TemplateStructureDto;

  @ApiProperty({
    type: TemplateMetadataDto,
    description: 'Metadata for optimizing the template',
  })
  @ValidateNested()
  @Type(() => TemplateMetadataDto)
  metadata: TemplateMetadataDto;
}
