import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class GetQuotaDto {
  @ApiProperty({
    enum: Platform,
    description: 'The platform (e.g. X, LinkedIn, Facebook, Instagram)',
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({ description: 'The social account ID this quota applies to' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({
    description: 'The action being checked, e.g. posts:create, analytics:read',
  })
  @IsString()
  @IsNotEmpty()
  action: string;
}
