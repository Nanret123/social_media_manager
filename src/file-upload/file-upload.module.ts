import { CloudinaryProvider } from './cloudinary.config';
import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';

@Module({
  controllers: [FileUploadController],
  providers: [CloudinaryProvider, FileUploadService],
})
export class FileUploadModule {}
