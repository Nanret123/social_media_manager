import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  IsUUID,
} from 'class-validator';
import { Platform, PostStatus } from '@prisma/client';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PostFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: PostStatus,
    description: 'Filter by post status',
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({
    enum: Platform,
    description: 'Filter by social platform',
  })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Start date for scheduled or created posts',
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date for scheduled or created posts',
  })
  @IsOptional()
  @IsDateString()
  endDate?: Date;
}
