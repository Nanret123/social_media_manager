// src/organizations/dto/organization-stats.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class OrganizationStatsDto {
  @ApiProperty({
    description: 'Total number of posts ever created under the organization',
    example: 240,
  })
  totalPosts: number;

  @ApiProperty({
    description: 'Number of posts currently scheduled for future publishing',
    example: 35,
  })
  scheduledPosts: number;

  @ApiProperty({
    description: 'Number of AI-generated contents (captions, images, etc.) used by the organization',
    example: 120,
  })
  aiGenerations: number;

  @ApiProperty({
    description: 'Total number of team members (including owner and admins)',
    example: 8,
  })
  teamMembers: number;

  @ApiProperty({
    description: 'Average engagement rate across posts (%)',
    example: 4.5,
  })
  engagementRate: number;
}
