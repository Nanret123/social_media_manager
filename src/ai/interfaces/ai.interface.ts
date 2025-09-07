import { AspectRatio } from "@prisma/client";

export enum Platform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  X = 'x'
}

export enum ContentType {
  POST = 'post',
  STORY = 'story',
  REEL = 'reel'
}

export enum ToneType {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  WITTY = 'witty',
  FRIENDLY = 'friendly'
}

export interface ContentRequest {
  organizationId: string;
  platform: Platform;
  contentType: ContentType;
  topic: string;
  tone: ToneType;
  includeHashtags?: boolean;
}

export interface GeneratedContent {
  id: string;
  caption: string;
  hashtags?: string[];
  changesMade?: string[];
  adaptationsMade?: string[];
  originalContent?: string;
  performancePrediction?: string;
  cost: number;
}

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
}

export interface GeneratedImage {
  id: string;
  url: string;
  alt: string;
  cloudinaryPublicId: string;
  cost: number;
}
