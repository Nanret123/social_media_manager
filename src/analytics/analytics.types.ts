export type MetricType = 'likes' | 'comments' | 'shares' | 'impressions' | 'clicks' | 'reach' | 'saves' | 'video_views';

export interface PlatformMetrics {
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
  reach: number;
  saves: number;
  videoViews: number;
  engagementRate: number;
}

export interface PostAnalytics {
  postId: string;
  platformPostId: string;
  metrics: PlatformMetrics;
  snapshotTime: Date;
}

export interface AnalyticsOverview {
  totalPosts: number;
  totalEngagement: number;
  averageEngagementRate: number;
  topPerformingPost?: { postId: string; engagementRate: number };
  platformBreakdown: PlatformMetrics[];
  timeframe: { start: Date; end: Date };
}

export interface ReportOptions {
  startDate: Date;
  endDate: Date;
  platforms: string[];
  metrics: MetricType[];
  format: 'json' | 'csv' | 'pdf';
}

export interface ProcessedWebhookEngagement {
  postId: string;
  platformPostId: string;
  platform: string;
  type: MetricType;
  delta: number;
  timestamp: Date;
}