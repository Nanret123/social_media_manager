import { Module } from '@nestjs/common';
import { SocialPostingService } from './social-posting.service';
import { SocialPostingController } from './social-posting.controller';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { FacebookClient } from './clients/facebook.client';
import { InstagramClient } from './clients/instagram.client';
import { LinkedInClient } from './clients/linkedin.client';
import { TwitterClient } from './clients/twitter.client';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [RateLimitModule, MediaModule ],
  controllers: [SocialPostingController],
  providers: [SocialPostingService, FacebookClient, InstagramClient, LinkedInClient, TwitterClient],
  exports: [SocialPostingService],
})
export class SocialPostingModule {}
