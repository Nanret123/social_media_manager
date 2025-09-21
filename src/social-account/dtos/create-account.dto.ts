// src/social-account/dto/create-social-account.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { Platform } from '@prisma/client';

export class CreateSocialAccountDto {
  @IsNotEmpty()
  @IsString()
  organizationId: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsNotEmpty()
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;

  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  tokenExpiresAt?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}