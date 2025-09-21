import { Controller } from '@nestjs/common';
import { SchedulerService } from '../posts/scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('posts/:postId/schedule')
  async schedulePost(
    @Param('postId') postId: string,
    @Body('scheduledAt') scheduledAt: string,
  ): Promise<{ jobId: string }> {
    const jobId = await this.schedulerService.schedulePost(
      postId,
      new Date(scheduledAt),
    );
    return { jobId };
  }

  @Post('posts/:postId/publish-now')
  async publishNow(@Param('postId') postId: string): Promise<{ jobId: string }> {
    const jobId = await this.schedulerService.publishImmediately(postId);
    return { jobId };
  }

  @Post('posts/:postId/cancel')
  async cancelSchedule(@Param('postId') postId: string): Promise<void> {
    await this.schedulerService.cancelScheduledPost(postId);
  }

  @Get('queue')
  async getQueueStatus(@Query('organizationId') organizationId: string): Promise<any[]> {
    return this.schedulerService.getQueueStatus(organizationId);
  }
}
}
