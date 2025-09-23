// src/organizations/invitations/dto/invite-member.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  permissions?: Record<string, boolean>;
}