import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to be uploaded',
  })
  file: any;
}

export class UploadMultipleFilesDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Multiple files to be uploaded',
  })
  files: any[];
}

export class DeleteDto {
  @ApiProperty({
    description: 'Cloudinary public_id of the file to be deleted',
    example: 'uploads/sample_image',
  })
  fileId: string;
}
