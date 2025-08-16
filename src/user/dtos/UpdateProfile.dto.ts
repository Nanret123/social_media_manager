import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsObject,
} from 'class-validator';

export class UpdateProfile {
  @ApiPropertyOptional({ example: 'John', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({
    example: 'Software engineer who loves NestJS',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;


  @ApiPropertyOptional({
    description: 'User notification preferences',
    example: { email: true, sms: false, push: true },
  })
  @IsOptional()
  @IsObject()
  notifications?: any;
}
