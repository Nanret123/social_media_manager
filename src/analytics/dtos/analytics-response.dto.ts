import { Platform } from "@prisma/client";

// src/analytics/dtos/analytics-response.dto.ts
export interface AnalyticsSummary {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  totalClicks: number;
  engagementRate: number;
  clickThroughRate: number;
}

export interface PlatformPerformance {
  platform: Platform;
  metrics: AnalyticsSummary;
  percentageChange: number;
}

export interface TimeSeriesData {
  date: string;
  metrics: AnalyticsSummary;
}