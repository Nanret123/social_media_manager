import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @ApiProperty({ description: 'Authorization code from OAuth flow' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Encrypted state from OAuth flow' })
  @IsString()
  encryptedState: string;
}
