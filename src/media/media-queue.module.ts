import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaProcessor } from './media.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'media-processing', // Name of our new queue
    }),
  ],
  providers: [MediaProcessor, MediaService, PrismaService],
})
export class MediaQueueModule {}