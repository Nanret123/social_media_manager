import { Platform } from "@prisma/client";
import { IsEnum, IsString, MinLength, MaxLength, IsOptional, IsArray, IsUrl, IsObject } from "class-validator";

// src/social-posting/dto/publish-post.dto.ts
export class PublishPostDto {
  @IsEnum(Platform)
  platform: Platform;

  @IsString()
  accountId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(280) // Platform-specific validation will handle this
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsObject()
  options?: {
    link?: string;
    location?: string;
    tags?: string[];
  };
}