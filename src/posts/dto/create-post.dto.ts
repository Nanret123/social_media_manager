import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreatePost {
  @ApiProperty({
    description: 'The ID of the connected social account to post from',
    example: 'b3e3f8e9-3d7c-42c5-8e0d-9b7a54c88e4c',
  })
  @IsUUID()
  socialAccountId: string;

  @ApiProperty({
    description: 'The main content of the post',
    example: 'Excited to announce our new AI-powered feature today!',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'List of media URLs (e.g., images hosted on Cloudinary)',
    example: [
      'https://res.cloudinary.com/demo/image/upload/v1234567890/sample1.jpg',
      'https://res.cloudinary.com/demo/image/upload/v1234567890/sample2.jpg',
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @ApiProperty({
    description: 'When the post should be published (ISO 8601 datetime)',
    example: '2025-08-25T15:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: Date;
}
