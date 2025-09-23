// src/organizations/types/organization.types.ts
export interface OrganizationUsage {
  memberCount: number;
  creditUsage: number;
  postCount: number;
  mediaStorage: number;
  maxMembers: number;
  monthlyCreditLimit?: number;
}

export interface OrganizationStats {
  totalPosts: number;
  scheduledPosts: number;
  aiGenerations: number;
  teamMembers: number;
  engagementRate: number;
}