import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UploadFileDto {
   @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to be uploaded',
  })
  file: any;
}
