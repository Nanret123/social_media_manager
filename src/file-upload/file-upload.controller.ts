import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { UploadFileDto, UploadMultipleFilesDto } from './dto/index.dto';
import { Public } from 'src/auth/decorators/public.decorator';
@ApiTags('File Upload')
@Controller('file-upload')
export class FileUploadController {
  constructor(private readonly service: FileUploadService) {}

  //upload one file
  @Public()
  @ApiOperation({ summary: 'Upload one file' })
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'File upload', type: UploadFileDto }) // Use DTO
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      example: {
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    },
  })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.service.uploadFile(file);
    return { url: result.secure_url };
  }

  // Upload multiple images
  @Public()
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
        urls: [
          'https://res.cloudinary.com/demo/image/upload/file1.jpg',
          'https://res.cloudinary.com/demo/image/upload/file2.jpg',
        ],
      },
    },
  })
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 8)) // Allow up to 10 files
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await this.service.uploadMultipleFiles(files);
    return { urls: results.map((file) => file.secure_url) };
  }

  // Delete a file
  @Public()
  @ApiOperation({ summary: 'Delete a file from Cloudinary' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    schema: {
      example: { message: 'File deleted successfully', result: {} },
    },
  })
  @Delete()
  async deleteFile(@Body('fileId') fileId: string) {
    const result = await this.service.deleteFile(fileId);
    console.log('deleted successfully', result);
    return { message: 'File deleted successfully', result };
  }
}
