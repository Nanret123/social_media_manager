import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class DeleteMultipleFilesDto {
  @ApiProperty({
    description: 'List of file IDs to delete',
    example: ['file123', 'file456'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  fileIds: string[];
}
