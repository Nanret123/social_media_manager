import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DisconnectAccountDto {
  @ApiProperty({ description: 'Social account ID to disconnect' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Organization ID of the account' })
  @IsString()
  organizationId: string;
}
