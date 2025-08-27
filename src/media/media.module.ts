import { CloudinaryProvider } from './cloudinary.config';
import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { FileUploadController } from './file-upload.controller';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports:[
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50000000, // 50MB
        files: parseInt(process.env.MAX_FILES_PER_POST) || 10,
      },
    }),
    BullModule.registerQueue({
      name: 'media-processing',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  controllers: [FileUploadController],
  providers: [CloudinaryProvider, MediaService],
})
export class FileUploadModule {}
