import { PartialType } from '@nestjs/mapped-types';
import { CreateSocialAccountDto } from './create-account.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateSocialAccountDto extends PartialType(
  CreateSocialAccountDto,
) {
  @ApiPropertyOptional({ description: 'Activate or deactivate the account' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
