import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ResetPassword {
  @ApiProperty({
    example: 'abc123resetToken',
    description: 'Reset token received via email',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewPass456!',
    description: 'New password (min 8 chars)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
