import { IsOptional, IsString, MaxLength, IsUrl, IsObject, ValidateNested, IsBoolean } from "class-validator";

// src/brand-kit/dto/create-brand-kit.dto.ts
export class CreateBrandKitDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  colors?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandVoice?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsObject()
  socialHandles?: Record<string, string>;

  @IsOptional()
  @IsObject()
  guidelines?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}