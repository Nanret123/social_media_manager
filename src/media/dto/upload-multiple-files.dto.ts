import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UploadMultipleFilesDto {
  @ApiProperty({ description: 'ID of the user uploading the files' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'ID of the organization' })
  @IsString()
  organizationId: string;
}
