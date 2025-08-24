import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SocialAccountDto {
  @ApiProperty({
    description: 'LinkedIn Person URN ID (e.g., abc123...)',
    example: 'abcd1234xyz',
  })
  @IsNotEmpty()
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'LinkedIn OAuth access token for the account',
    example: 'AQX3Zy2...long-token...',
  })
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}

class MediaDto {
  @ApiProperty({
    description: 'Public URL of the media (e.g., Cloudinary URL)',
    example: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
  })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Title of the media file',
    example: 'Our new product launch',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Short description of the media file',
    example: 'An image showcasing our product features',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class PublishPostDto {
  @ApiProperty({
    description: 'The social account information to publish to LinkedIn',
    type: SocialAccountDto,
  })
  @ValidateNested()
  @Type(() => SocialAccountDto)
  socialAccount: SocialAccountDto;

  @ApiProperty({
    description: 'Main content of the post',
    example: 'Excited to announce our new product launch!',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'List of media files (images) to attach to the post',
    type: [MediaDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  media?: MediaDto[];
}
