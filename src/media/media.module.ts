import { CloudinaryProvider } from './cloudinary.config';
import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import {  MediaController } from './media.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, 
        files: parseInt(process.env.MAX_FILES_PER_POST) || 10,
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, CloudinaryProvider, CloudinaryService],
  exports: [MediaService, CloudinaryService],
})
export class MediaModule {}