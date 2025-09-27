import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsObject,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class CreateBrandKitDto {
  @ApiProperty({ description: 'Name of the brand kit', example: 'My Brand' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Logo URL of the brand',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({
    description: 'Brand primary and secondary colors',
    example: ['#FF0000', '#00FF00'],
  })
  @IsOptional()
  @IsArray()
  colors?: string[];

  @ApiProperty({
    description: 'Brand voice description',
    example: 'Friendly and professional',
  })
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiProperty({
    description: 'Preferred tone',
    example: 'Casual, professional',
  })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({
    description: 'Social media handles',
    example: { twitter: '@brand', instagram: '@brand' },
  })
  @IsOptional()
  @IsObject()
  socialHandles?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Brand guidelines and key messaging',
    example: {
      keyMessaging: ['Innovative', 'Reliable'],
      targetAudience: 'Young adults',
    },
  })
  @IsOptional()
  @IsObject()
  guidelines?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Set as default brand kit',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBrandKitDto extends CreateBrandKitDto {}
