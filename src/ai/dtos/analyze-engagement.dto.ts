import { ApiProperty } from "@nestjs/swagger";
import { Platform } from "@prisma/client";
import { IsString, IsEnum } from "class-validator";

export class AnalyzeEngagementDto {
  @ApiProperty({ description: 'Content text to analyze for engagement' })
  @IsString()
  content: string;

  @ApiProperty({ enum: Platform, description: 'Platform where the content will be posted' })
  @IsEnum(Platform)
  platform: Platform;
}