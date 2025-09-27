export interface TrackUsageParams {
  organizationId: string;
  userId: string;
  type: string;
  tokensUsed: number;
  cost: number;
  metadata?: any;
}

export interface ContentOptimization {
  original: string;
  optimized: string;
  improvements: string[];
  score: number;
}