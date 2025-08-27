import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export enum ScheduleJobStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  PROCESSING = 'PROCESSING',
}

@Injectable()
export class SchedulerService {
  constructor(
    @InjectQueue('post-publishing') private postQueue: Queue,
    private prisma: PrismaService,
  ) {}

  private async setJobStatus(postId: string, status: ScheduleJobStatus) {
    await this.prisma.scheduleJob.update({
      where: { postId },
      data: { status },
    });
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
      data: {
        postId,
        jobId: job.id.toString(),
        status: ScheduleJobStatus.PENDING,
      },
    });
  }

  async cancelScheduledPost(postId: string, organizationId: string): Promise<void> {
    // First, find the post and verify it belongs to the user's organization
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
    });

    if (!post) {
      throw new NotFoundException(
        'Post not found or you do not have permission to cancel it.',
      );
    }

    const scheduleJob = await this.prisma.scheduleJob.findUnique({
      where: { postId },
    });
    if (!scheduleJob) return;

    const job = await this.postQueue.getJob(scheduleJob.jobId);
    if (job) await job.remove();

    await this.setJobStatus(postId, ScheduleJobStatus.CANCELLED);
  }

  async getScheduledPosts(organizationId: string) {
    return this.prisma.post.findMany({
      where: { organizationId, status: 'SCHEDULED' },
      include: {
        socialAccount: { select: { platform: true, username: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async onApplicationBootstrap() {
    // Find all jobs that are stuck in a pending state
    const stuckJobs = await this.prisma.scheduleJob.findMany({
      where: { status: ScheduleJobStatus.PENDING },
      include: { post: true },
    });

    for (const job of stuckJobs) {
      // If the post's scheduled time is in the past, try to publish it now
      if (job.post.scheduledAt < new Date()) {
        await this.postQueue.add(
          'publish-post',
          { postId: job.postId },
          { delay: 0 },
        );
      } else {
        // If it's still in the future, re-schedule it
        await this.schedulePost(job.postId, job.post.scheduledAt);
      }
    }
  }
}
