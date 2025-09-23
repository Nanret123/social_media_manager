// src/organizations/dto/create-organization.dto.ts
import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  billingEmail?: string;
}