import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LinkGoogleAccountDto {
  @ApiProperty({ example: 'StrongPass123!', description: 'User password' })
  @IsString()
  @MinLength(1)
  password: string;
}
