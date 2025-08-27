import { Processor, Process } from '@nestjs/bull';
import { ScheduleJobStatus } from '@prisma/client';
import { Job } from 'bull';
import { PlatformsService } from 'src/platforms/platforms.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Processor('post-publishing')
export class PostProcessor {
  constructor(
    private platformService: PlatformsService,
    private prisma: PrismaService,
  ) {}

  private async setJobStatus(postId: string, status: ScheduleJobStatus) {
    await this.prisma.scheduleJob.update({
      where: { postId },
      data: { status },
    });
  }

  @Process('publish-post')
  async publishPost(job: Job<{ postId: string }>) {
    const { postId } = job.data;

    try {
      await this.setJobStatus(postId, ScheduleJobStatus.PROCESSING);

      const result = await this.platformService.publishPost(postId);

      // UPDATE THE POST STATUS TOO!
      await this.prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });

      await this.setJobStatus(postId, ScheduleJobStatus.COMPLETED);
      return result;
    } catch (error) {
      const errorMessage = error.message || 'Unknown publishing error';

      // UPDATE THE POST STATUS TOO!
      await this.prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED', errorMessage },
      });

      await this.setJobStatus(postId, ScheduleJobStatus.FAILED);
      this.logger.error(`Failed to publish post ${postId}: ${errorMessage}`);
      throw error; // Let BullMQ handle the retry
    }
  }
}
