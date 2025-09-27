import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { BullModule } from '@nestjs/bull';
import { SocialPostingModule } from 'src/social-posting/social-posting.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'post-scheduling', 
    }),
    SocialPostingModule
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
