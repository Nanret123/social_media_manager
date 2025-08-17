import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client'; // or your enum source

class UserResponseDto {
  @ApiProperty({ example: 'uuid-1234', description: 'Unique user ID' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  email: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @ApiProperty({ example: 'https://cdn.example.com/avatar.png', required: false, description: 'Profile avatar URL' })
  avatar?: string;

  @ApiProperty({ enum: AuthProvider, example: AuthProvider.LOCAL, description: 'Auth provider used' })
  provider: AuthProvider;

  @ApiProperty({ example: true, description: 'Whether the email is verified' })
  emailVerified: boolean;
}

class TokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ example: 'f7c7b4a8-3d1b-49d7-bf3f-1234567890ab', description: 'Refresh token' })
  refreshToken: string;
}

export class AuthResponse {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: TokensResponseDto })
  tokens: TokensResponseDto;
}
