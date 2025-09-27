import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetConversationsDto {
  @ApiPropertyOptional({ description: 'Optional platform filter' })
  @IsOptional()
  @IsString()
  platform?: string;
}
