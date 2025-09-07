import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Platform } from "@prisma/client";
import { IsString, IsEnum, IsOptional, IsBoolean } from "class-validator";

export class PlatformOptimizeDto {
  @ApiProperty()
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Original content text' })
  @IsString()
  content: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  fromPlatform: Platform;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  toPlatform: Platform;

  @ApiPropertyOptional({ description: 'Whether to keep original tone' })
  @IsOptional()
  @IsBoolean()
  maintainTone?: boolean = false;
}
