import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateOrganization {
  @ApiProperty({
    description: 'Name of the organization',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description:
      'Unique slug identifier for the organization (lowercase, numbers, hyphens only)',
    example: 'acme-corp',
    minLength: 2,
    maxLength: 30,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(30)
  slug?: string;
}
