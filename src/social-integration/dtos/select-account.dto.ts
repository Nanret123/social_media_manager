import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class SelectAccountDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  organizationId: string;

  @ApiProperty({ description: 'Selected account ID' })
  @IsString()
  selectedAccountId: string;

  @ApiProperty({ description: 'Original encrypted state from OAuth callback' })
  @IsString()
  encryptedState: string;
}