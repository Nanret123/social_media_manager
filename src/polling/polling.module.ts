import { Module } from '@nestjs/common';
import { PollingService } from './polling.service';
import { PollingController } from './polling.controller';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { LinkedinPollingService } from './linkedin-polling.service';
import { XPollingService } from './x-polling.service';
import { SocialAccountModule } from 'src/social-account/social-account.module';
import { LinkedinApiClient } from './clients/linkedin-api.client';
import { XApiClient } from './clients/x-api.client';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'engagement-processing', // Queue for engagement jobs
    }),

    SocialAccountModule,
    RateLimitModule
  ],
  controllers: [PollingController],
  providers: [PollingService, LinkedinPollingService,
    XPollingService,
    LinkedinApiClient,
    XApiClient,],
})
export class PollingModule {}
