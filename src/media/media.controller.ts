
import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { UploadFileDto, UploadMultipleFilesDto } from './dto/index.dto';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  /**
   * Upload one file
   */
  @ApiOperation({ summary: 'Upload one file' })
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'File upload', type: UploadFileDto })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      example: {
        id: 'clm9s4d85000p7y7w6g0xxyz',
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'rooli/sample',
      },
    },
  })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    // TODO: replace with real user/org IDs from auth context
    const media = await this.service.uploadFile('userId', 'orgId', file);

    return {
      id: media.id,
      url: media.url,
      publicId: media.publicId,
    };
  }

  /**
   * Upload multiple files
   */
  @ApiOperation({ summary: 'Upload multiple files' })
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multiple files upload',
    type: UploadMultipleFilesDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    schema: {
      example: {
        files: [
          {
            id: 'clm9s4d85000p7y7w6g0xabc',
            url: 'https://res.cloudinary.com/demo/image/upload/file1.jpg',
            publicId: 'rooli/file1',
          },
          {
            id: 'clm9s4d85000p7y7w6g0xdef',
            url: 'https://res.cloudinary.com/demo/image/upload/file2.jpg',
            publicId: 'rooli/file2',
          },
        ],
      },
    },
  })
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 8)) // up to 8 files
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // TODO: replace with real user/org IDs from auth context
    const mediaFiles = await this.service.uploadMultipleFiles(files, 'userId', 'orgId');

    return {
      files: mediaFiles.map((media) => ({
        id: media.id,
        url: media.url,
        publicId: media.publicId,
      })),
    };
  }

  /**
   * Delete a file
   */
  @ApiOperation({ summary: 'Delete a file from Cloudinary' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    schema: {
      example: { message: 'File deleted successfully' },
    },
  })
  @Delete()
  async deleteFile(@Body('fileId') fileId: string) {
    if (!fileId) throw new BadRequestException('fileId is required');

    await this.service.deleteFile(fileId);

    return { message: 'File deleted successfully' };
  }
}