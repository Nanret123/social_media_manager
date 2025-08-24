import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

class AuthUserDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: 'a3f6c2e7-5b0a-42d9-9c9c-7c6a8b9f1234',
  })
  id: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
    required: false,
  })
  firstName?: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Doe',
    required: false,
  })
  lastName?: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: UserRole,
    example: UserRole.USER,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Indicates whether the user has verified their email',
    example: true,
  })
  isEmailVerified: boolean;
}

class AuthTokensDto {
  @ApiProperty({
    description: 'JWT access token for authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for renewing access',
    example: 'dGhpc2lzbXlyZWZyZXNodG9rZW4...',
  })
  refreshToken: string;
}

export class AuthResponse {
  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: () => AuthTokensDto })
  tokens: AuthTokensDto;
}

