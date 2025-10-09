// enhance-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Platform, ToneType } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EnhanceContentDto {
  @ApiProperty({ example: 'cmggo07ws0001iamsrcw4mzpe' })
  @IsString()
  @IsNotEmpty()
  contentId: string;

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
