import { Module } from '@nestjs/common';
import { SocialSchedulerService } from './social-scheduler.service';
import { EncryptionService } from 'src/common/utility/encryption.service';
import { HttpModule } from '@nestjs/axios';
import { FacebookPlatformService } from './platforms/facebook-platform.service';
import { BullModule } from '@nestjs/bull';
import { SocialSchedulerController } from './social-scheduler.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({
      name: 'social-posting',
    }),
  ],
  controllers: [SocialSchedulerController], 
  providers: [SocialSchedulerService, FacebookPlatformService, EncryptionService],
  exports: [SocialSchedulerService],
})
export class SocialSchedulerModule {}
