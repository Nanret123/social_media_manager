import { CloudinaryProvider } from './cloudinary.config';
import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import {  MediaController } from './media.controller';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
        files: parseInt(process.env.MAX_FILES_PER_POST) || 10,
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, CloudinaryProvider],
  exports: [MediaService],
})
export class MediaModule {}