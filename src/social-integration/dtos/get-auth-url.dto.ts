import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class GetAuthUrlDto {
  @ApiProperty({ enum: Platform, description: 'Platform to connect' })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({ description: 'Organization ID connecting the account' })
  @IsString()
  organizationId: string;
}
