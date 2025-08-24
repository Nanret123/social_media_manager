import { Processor, Process } from "@nestjs/bull";
import { ScheduleJobStatus } from "@prisma/client";
import { Job } from "bull";
import { PlatformsService } from "src/platforms/platforms.service";
import { PrismaService } from "src/prisma/prisma.service";

@Processor('post-publishing')
export class PostProcessor {
  constructor(
    private platformService: PlatformsService,
    private prisma: PrismaService,
  ) {}

  private async setJobStatus(postId: string, status: ScheduleJobStatus) {
    await this.prisma.scheduleJob.update({ where: { postId }, data: { status } });
  }

  @Process('publish-post')
  async publishPost(job: Job<{ postId: string }>) {
    const { postId } = job.data;

    try {
      await this.setJobStatus(postId, ScheduleJobStatus.PROCESSING);

      const result = await this.platformService.publishPost(postId);

      await this.setJobStatus(postId, ScheduleJobStatus.COMPLETED);
      return result;
    } catch (error) {
      await this.setJobStatus(postId, ScheduleJobStatus.FAILED);
      console.error(`Failed to publish post ${postId}:`, error);
      throw error;
    }
  }
}
