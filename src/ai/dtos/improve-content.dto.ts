import { ApiProperty } from '@nestjs/swagger';
import { Platform, ToneType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ImprovementType {
  GRAMMAR = 'grammar',
  ENGAGEMENT = 'engagement',
  CLARITY = 'clarity',
  TONE = 'tone',
  LENGTH = 'length',
}

export class ImproveContentDto {
  @ApiProperty({
    description: 'The platform where the content will be posted',
    enum: Platform,
    example: Platform.X,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    description: 'The type of improvement to apply',
    enum: ImprovementType,
    example: ImprovementType.ENGAGEMENT,
  })
  @IsEnum(ImprovementType)
  improvementType: ImprovementType;

  @ApiProperty({
    description: 'The original content to improve',
    example: 'Our product is amazing! Buy now!',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Target tone if improvementType is "tone"',
    enum: ToneType,
    required: false,
    example: ToneType.PROFESSIONAL,
  })
  @IsOptional()
  @IsEnum(ToneType)
  targetTone?: ToneType;
}
