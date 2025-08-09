import { ApiProperty } from '@nestjs/swagger';

export class AuthResponse {
  @ApiProperty({ example: 'access.jwt.token', description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({
    example: 'refresh.jwt.token',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: {
      id: 'uuid-1234',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
    },
    description: 'Authenticated user details',
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  };
}
