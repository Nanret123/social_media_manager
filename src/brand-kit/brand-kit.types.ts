export interface BrandColor {
  name: string;
  value: string; // Hex code
  type: BrandColorType;
  order?: number;
}

export interface BrandFont {
  name: string;
  category: FontCategory;
  weight?: string;
  isCustom?: boolean;
  customUrl?: string;
}

export interface SocialHandles {
  twitter?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
}

export interface CreateBrandKitDto {
  name: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  brandVoice?: BrandVoice;
  brandWords?: string[];
  bannedWords?: string[];
  socialHandles?: SocialHandles;
  websiteUrl?: string;
}

export interface UpdateBrandKitDto extends Partial<CreateBrandKitDto> {
  isActive?: boolean;
}

export interface BrandValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

export interface BrandVoiceAnalysis {
  tone: BrandVoice;
  confidence: number;
  suggestions: string[];
}

// Enums
export enum BrandColorType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  ACCENT = 'ACCENT',
  NEUTRAL = 'NEUTRAL',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export enum FontCategory {
  HEADING = 'HEADING',
  BODY = 'BODY',
  ACCENT = 'ACCENT'
}

export enum BrandVoice {
  PROFESSIONAL = 'PROFESSIONAL',
  CASUAL = 'CASUAL',
  WITTY = 'WITTY',
  ENTHUSIASTIC = 'ENTHUSIASTIC',
  AUTHORITATIVE = 'AUTHORITATIVE',
  FRIENDLY = 'FRIENDLY',
  INSPIRATIONAL = 'INSPIRATIONAL'
}