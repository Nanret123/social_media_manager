import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsUrl, IsOptional, IsInt, Min, Max } from "class-validator";

export class GenerateImageVariationsDto {
  @ApiProperty({
    description: 'The ID of the organization requesting the image variations',
    example: 'd2f4a1e0-8c43-4f1b-9d11-2b912ab3e456',
  })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'The original image URL to generate variations from',
    example: 'https://example.com/images/original.png',
  })
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    description: 'Number of image variations to generate',
    example: 3,
    minimum: 1,
    maximum: 10,
    default: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number = 2;
}