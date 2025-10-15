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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { UploadMultipleFilesDto } from './dto/upload-multiple-files.dto';
import { DeleteMultipleFilesDto } from './dto/delete-files.dto';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media/:organizationId')
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
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Param('organizationId') organizationId: string,
  ) {
    const result = await this.mediaService.uploadFile(
      req.user.id,
      organizationId,
      file,
    );
    return {
      url: result.url,
      publicId: result.publicId,
    };
  }

  @Post('upload/multiple/:organizationId')
  @ApiOperation({ summary: 'Upload multiple media files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload multiple media files',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultipleFiles(
    @Param('organizationId') organizationId: string,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.mediaService.uploadMultipleFiles(
      files,
      req.user.id,
      organizationId,
    );
  }

  @Delete('files')
  @ApiOperation({ summary: 'Delete multiple files' })
  @ApiResponse({
    status: 200,
    description: 'Multiple files deleted successfully',
  })
  async deleteMultiple(
    @Param('organizationId') orgId: string,
    @Body() dto: DeleteMultipleFilesDto,
  ) {
    return this.mediaService.deleteMultipleFiles(dto.fileIds, orgId);
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete a media file' })
  async deleteFile(
    @Param('fileId') fileId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.mediaService.deleteFile(fileId, organizationId);
  }

  @Get(':fileId')
  @ApiOperation({ summary: 'Get a media file by ID' })
  async getFileById(@Param('fileId') fileId: string) {
    return this.mediaService.getFileById(fileId);
  }
}
