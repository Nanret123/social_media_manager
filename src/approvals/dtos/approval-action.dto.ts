import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ApprovalActionDto {
  @ApiPropertyOptional({ description: 'Optional comments from the approver' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Optional revision notes for changes requested',
  })
  @IsOptional()
  @IsString()
  revisionNotes?: string;
}
