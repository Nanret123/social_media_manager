import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MarkAllReadDto {
  @ApiProperty({ description: 'Organization ID to mark all notifications as read' })
  @IsString()
  organizationId: string;
}