import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class SaveGeneratedMediaDto {
  @ApiProperty({ description: 'ID of the user saving the media' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'ID of the organization' })
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'URL of the media' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Cloudinary public ID of the media' })
  @IsString()
  publicId: string;

  @ApiPropertyOptional({ description: 'Filename', example: 'my_image.png' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: 'Original name of the file' })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiPropertyOptional({ description: 'MIME type' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiPropertyOptional({ description: 'AI generation ID' })
  @IsOptional()
  @IsString()
  aiGenerationId?: string;

  @ApiPropertyOptional({
    description: 'AI generation context (prompt, model, etc.)',
  })
  @IsOptional()
  @IsObject()
  aiGenerationContext?: Record<string, any>;
}
