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
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { SaveGeneratedMediaDto } from './dto/save-generated-media.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { UploadMultipleFilesDto } from './dto/upload-multiple-files.dto';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single media file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.mediaService.uploadFile(dto.userId, dto.organizationId, file);
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

  @Post('save-generated')
  @ApiOperation({ summary: 'Save an already-uploaded AI-generated media' })
  async saveGeneratedMedia(@Body() dto: SaveGeneratedMediaDto) {
    return this.mediaService.saveGeneratedMedia(dto);
  }

  @Get('ai-generated')
  @ApiOperation({ summary: 'Get paginated AI-generated media' })
  async getAIGeneratedMedia(
    @Query('organizationId') organizationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.mediaService.getAIGeneratedMedia(organizationId, page, limit);
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
