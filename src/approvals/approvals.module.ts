import {  Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { SchedulingModule } from 'src/scheduling/scheduling.module';
import { SocialSchedulerModule } from 'src/social-scheduler/social-scheduler.module';

@Module({
  imports: [
    NotificationModule,
    SchedulingModule,
     SocialSchedulerModule
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
