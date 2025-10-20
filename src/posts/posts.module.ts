import {  Module, Post } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { SchedulingModule } from 'src/scheduling/scheduling.module';
import { ApprovalsModule } from 'src/approvals/approvals.module';
import { MediaModule } from 'src/media/media.module';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { PostPublishingModule } from 'src/post-publishing/post-publishing.module';

@Module({
  imports: [
    SchedulingModule,
    ApprovalsModule,
    MediaModule,
    RateLimitModule,
    PostPublishingModule
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
  ],
})
export class PostsModule {}
