import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ApprovalRequestDto {
  @ApiProperty({ description: 'ID of the post to request approval for' })
  @IsString()
  postId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  organizationId: string;
}

