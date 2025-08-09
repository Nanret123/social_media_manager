import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmail {
  @ApiProperty({
    example: 'verifyToken123',
    description: 'Email verification token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
