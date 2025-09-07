import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsageService } from './usage.service';

@Module({
  controllers: [AiController],
  providers: [AiService, UsageService],
})
export class AiModule {}
