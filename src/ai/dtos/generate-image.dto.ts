import { ApiProperty } from "@nestjs/swagger";
import { AspectRatio, Platform } from "@prisma/client";
import { IsString, IsEnum } from "class-validator";

export enum ImageQuality {
  STANDARD = "standard",
  HD = "hd",
}

export class GenerateImageDto {
  @ApiProperty({
    description: 'Prompt describing the image to generate',
    example: 'A futuristic city skyline at sunset',
  })
  @IsString()
  prompt: string;

  @ApiProperty({
    enum: AspectRatio,
    description: 'Aspect ratio for the generated image',
    example: AspectRatio.LANDSCAPE,
  })
  @IsEnum(AspectRatio)
  aspect: AspectRatio;

  @ApiProperty({
    description: 'The ID of the organization requesting the image generation',
    example: 'org_1234567890abcdef',
  })
  @IsString()
  organizationId: string;

  @ApiProperty({
      enum: Platform,
      description: 'The platform where the content will be posted',
      example: Platform.X,
    })
    @IsEnum(Platform)
    platform: Platform;

    @ApiProperty({
    enum: ImageQuality,
    description: "Image quality (standard or hd)",
    example: ImageQuality.STANDARD,
  })
  @IsEnum(ImageQuality)
  quality?: ImageQuality = ImageQuality.STANDARD; 
}