import { Module } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { PlatformsController } from './platforms.controller';
import { TwitterModule } from './twitter/twitter.module';
import { LinkedinModule } from './linkedin/linkedin.module';

@Module({
  controllers: [PlatformsController],
  providers: [PlatformsService],
  imports: [TwitterModule, LinkedinModule],
})
export class PlatformsModule {}
