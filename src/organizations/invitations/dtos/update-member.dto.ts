// src/organizations/members/dto/update-member.dto.ts
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  permissions?: Record<string, boolean>;
}