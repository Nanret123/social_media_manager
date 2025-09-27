import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { SchedulingModule } from 'src/scheduling/scheduling.module';
import { ApprovalsModule } from 'src/approvals/approvals.module';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports:[SchedulingModule, ApprovalsModule, MediaModule ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
