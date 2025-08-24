import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export enum ScheduleJobStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Injectable()
export class SchedulerService {
  constructor(
    @InjectQueue('post-publishing') private postQueue: Queue,
    private prisma: PrismaService,
  ) {}

  private async setJobStatus(postId: string, status: ScheduleJobStatus) {
    await this.prisma.scheduleJob.update({ where: { postId }, data: { status } });
  }

  async schedulePost(postId: string, scheduledAt: Date): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now();
    if (delay <= 0) throw new Error('Cannot schedule post in the past');

    const job = await this.postQueue.add(
      'publish-post',
      { postId },
      {
        delay,
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    await this.prisma.scheduleJob.create({
      data: { postId, jobId: job.id.toString(), status: ScheduleJobStatus.PENDING },
    });
  }

  async cancelScheduledPost(postId: string): Promise<void> {
    const scheduleJob = await this.prisma.scheduleJob.findUnique({ where: { postId } });
    if (!scheduleJob) return;

    const job = await this.postQueue.getJob(scheduleJob.jobId);
    if (job) await job.remove();

    await this.setJobStatus(postId, ScheduleJobStatus.CANCELLED);
  }

  async getScheduledPosts(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, status: 'SCHEDULED' },
      include: { socialAccount: { select: { platform: true, username: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

}
