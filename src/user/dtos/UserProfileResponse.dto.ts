import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponse {
  @ApiProperty({ example: 'b1f6b8e0-1234-4c56-a789-abcdef123456' })
  id: string;

  @ApiProperty({ example: 'johndoe@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Account status (ACTIVE, SUSPENDED, DEACTIVATED)',
  })
  accountStatus: string;

  @ApiProperty({ example: '2025-01-01T12:00:00Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2025-08-15T09:30:00Z' })
  lastLogin?: Date;

  @ApiProperty({
    example: {
      avatar: 'https://example.com/avatar.png',
      bio: 'Software engineer',
      timezone: 'Africa/Lagos',
      locale: 'en-US',
      subscriptionTier: 'premium',
      subscriptionEndsAt: '2025-12-31T23:59:59Z',
      notifications: { email: true, sms: false, push: true },
    },
  })
  profile: {
    avatar?: string;
    bio?: string;
    subscriptionTier: string;
    subscriptionEndsAt?: Date;
    notifications: any;
  };
}
