import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { BullModule } from '@nestjs/bull';
import { PlatformsModule } from 'src/platforms/platforms.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PostProcessor } from './post.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'post-publishing',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    PrismaModule,
    PlatformsModule,
  ],
  providers: [SchedulerService, PostProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
