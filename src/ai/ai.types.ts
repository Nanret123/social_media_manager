import { ToneType, Platform, ContentType } from "@prisma/client";

export interface AIGenerationRequest {
  prompt: string;
  tone?: ToneType;
  platform?: Platform;
  contentType?: ContentType;
  maxLength?: number;
  keywords?: string[];
  brandVoice?: string;
}

export interface AIGenerationResponse {
  content: string;
  hashtags: string[];
  suggestions?: string[];
  tokensUsed: number;
  cost: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  style?: 'photographic' | 'illustration' | '3d' | 'minimal' | 'vibrant';
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  brandColors?: string[];
}

export interface ImageGenerationResponse {
  imageUrl: string;
  revisedPrompt?: string;
  tokensUsed: number;
  cost: number;
}

export interface ContentOptimization {
  original: string;
  optimized: string;
  improvements: string[];
  score: number;
}

export interface AIUsageMetrics {
  totalTokens: number;
  totalCost: number;
  generationsCount: number;
  averageCostPerGeneration: number;
}

export interface GenerationContext {
  organizationId: string;
  userId: string;
  brandKitId?: string;
}

export interface RequestContext {
  userId: string;
  organizationId: string;
  brandKitId?: string;
  userRole: string;
}


export interface AIGenerationResponse {
  content: string;
  hashtags: string[];
  tokensUsed: number;
  cost: number;
  generationId: string;
}


export interface ImageGenerationResult {
  imageBuffer: Buffer;
  revisedPrompt: string;
  generationId: string;
  tokensUsed: number;
  cost: number;
}


export interface ContentOptimization {
  original: string;
  optimized: string;
  improvements: string[];
  score: number;
}

