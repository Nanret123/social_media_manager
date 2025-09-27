import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ description: 'ID of the user uploading the file' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'ID of the organization' })
  @IsString()
  organizationId: string;
}
