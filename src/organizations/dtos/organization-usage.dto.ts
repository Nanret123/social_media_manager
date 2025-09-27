import { ApiProperty } from '@nestjs/swagger';

export class OrganizationUsageDto {
  @ApiProperty({
    description: 'Total number of active members in the organization',
    example: 12,
  })
  memberCount: number;

  @ApiProperty({
    description: 'Total AI credit usage for the current billing period',
    example: 350,
  })
  creditUsage: number;

  @ApiProperty({
    description: 'Total number of posts created under the organization',
    example: 128,
  })
  postCount: number;

  @ApiProperty({
    description: 'Total storage used by media files in MB',
    example: 5240,
  })
  mediaStorage: number;

  @ApiProperty({
    description: 'Maximum allowed members for the current plan',
    example: 50,
  })
  maxMembers: number;

  @ApiProperty({
    description: 'Monthly AI credit limit based on the current plan',
    example: 1000,
    required: false,
  })
  monthlyCreditLimit?: number;
}
