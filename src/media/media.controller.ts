import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { SaveGeneratedMediaDto } from './dto/save-generated-media.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { UploadMultipleFilesDto } from './dto/upload-multiple-files.dto';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}


@ApiOperation({ summary: 'Upload a file (with Cloudinary)' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  description: 'Upload file with optional user/org context',
  type: UploadFileDto,
})
@ApiResponse({
  status: 200,
  description: 'File uploaded successfully',
  schema: {
    example: {
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      publicId: 'sample_abc123',
    },
  },
})
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UploadFileDto,
) {
  const result = await this.mediaService.uploadFile(
    dto?.userId,
    dto?.organizationId,
    file,
  );
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}


  @Post('upload/multiple')
  @ApiOperation({ summary: 'Upload multiple media files' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMultipleFilesDto,
  ) {
    return this.mediaService.uploadMultipleFiles(
      files,
      dto.userId,
      dto.organizationId,
    );
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete a media file' })
  async deleteFile(@Param('fileId') fileId: string) {
    return this.mediaService.deleteFile(fileId);
  }

  @Get(':fileId')
  @ApiOperation({ summary: 'Get a media file by ID' })
  async getFileById(@Param('fileId') fileId: string) {
    return this.mediaService.getFileById(fileId);
  }
}
