import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Platform, ContentType, ToneType } from "@prisma/client";
import { IsString, IsArray, IsEnum, IsOptional } from "class-validator";

export class MultiPlatformContentDto {
  @ApiProperty()
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Topic to generate content around' })
  @IsString()
  topic: string;

  @ApiProperty({ enum: Platform, isArray: true })
  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms: Platform[];

  @ApiProperty({ enum: ContentType })
  @IsEnum(ContentType)
  contentType: ContentType;

 @ApiProperty({
     enum: ToneType,
     description: 'The tone of the generated content',
     example: ToneType.PROFESSIONAL,
   })
   @IsEnum(ToneType)
   tone: ToneType;

  @ApiPropertyOptional({ description: 'Base content to optimize instead of generating fresh content' })
  @IsOptional()
  @IsString()
  baseContent?: string;
}