import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, MaxLength } from 'class-validator';

export class DeactivateAccount {
  @ApiProperty({ example: 'CurrentPassword123' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({
    example: 'I no longer need the account',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
