import { Module } from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { LinkedInController } from './linkedin.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports:[HttpModule],
  controllers: [LinkedInController],
  providers: [LinkedInService],
  exports: [LinkedInService],
})
export class LinkedinModule {}
