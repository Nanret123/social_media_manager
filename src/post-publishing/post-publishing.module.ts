import { Module } from '@nestjs/common';
import { PostPublishingController } from './post-publishing.controller';
import { FacebookClient } from './clients/facebook.client';
import { InstagramClient } from './clients/instagram.client';
import { LinkedInClient } from './clients/linkedin.client';
import { TwitterClient } from './clients/twitter.client';
import { PostPublishingService } from './post-publishing.service';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [RateLimitModule, MediaModule],
  controllers: [PostPublishingController],
  providers: [
    PostPublishingService,
    InstagramClient,
    FacebookClient,
    TwitterClient,
    LinkedInClient,
  ],
  exports: [PostPublishingService],
})
export class PostPublishingModule {}
