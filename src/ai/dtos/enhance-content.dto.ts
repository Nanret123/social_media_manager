// enhance-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Platform, ToneType } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EnhanceContentDto {
  @ApiProperty({ example: '🚀 Boost your brand visibility with these tips...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'INSTAGRAM' })
  @IsString()
  @IsNotEmpty()
  platform: Platform;

  @ApiProperty({ example: 'PROFESSIONAL' })
  @IsString()
  @IsNotEmpty()
  tone: ToneType;

  @ApiProperty({ example: 'Informative', required: false })
  @IsOptional()
  @IsString()
  style?: string;
}
