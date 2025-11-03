import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Get,
} from '@nestjs/common';
import { SocialSchedulerService } from './social-scheduler.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Social Scheduler')
@Controller('social-scheduler')
@ApiBearerAuth()
export class SocialSchedulerController {
  constructor(
    private readonly service: SocialSchedulerService,
    @InjectQueue('social-posting') private readonly queue: Queue,
  ) {}

  @Post(':postId/schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a post',
    description:
      'Schedules a post (text, image, or video) to be published at a specific time on a Facebook Page using the Page access token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Post successfully scheduled',
  })
  @ApiResponse({ status: 500, description: 'Failed to schedule post' })
  async schedulePost(@Param('postId') postId: string) {
    return this.service.schedulePost(postId);
  }

  @Post(':postId/publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publish a post immediately',
    description:
      'Publishes a post (text, image, or video) instantly on a Facebook Page using the Page access token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Post successfully published',
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 500, description: 'Failed to publish post' })
  async publishImmediately(@Param('postId') postId: string) {
    return this.service.publishImmediately(postId);
  }

  @Delete(':postId/:organizationId/cancel')
  @ApiOperation({
    summary: 'Cancel a scheduled Facebook post',
    description: `
      Cancels (deletes) a scheduled post.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled post successfully cancelled.',
    schema: {
      example: {
        success: true,
        message: 'Scheduled post cancelled successfully.',
      },
    },
  })
  async cancelScheduledPost(
    @Param('postId') postId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.service.cancelScheduledPost(postId, organizationId);
  }

  @Get('debug-setup')
  async debugSetup() {
    console.log('=== DEBUGGING WORKER SETUP ===');

    // 1. Check if processor is instantiated
    console.log('1. Checking SocialPostProcessor...');

    // 2. Check queue basic info (instead of isReady)
    console.log('2. Queue name:', this.queue.name);
    console.log('2. Queue client status:', (await this.queue.client).status);

    // 3. Check workers using the correct method
    let workers = [];
    try {
      workers = await this.queue.getWorkers();
      console.log('3. Active workers:', workers.length);
      console.log('3. Workers details:', workers);
    } catch (error) {
      console.log('3. Error getting workers:', error.message);
    }

    // 4. Check Redis connection
    try {
      const ping = (await this.queue.client).ping;
      console.log('4. Redis ping:', ping);
    } catch (error) {
      console.log('4. Redis ping failed:', error.message);
    }

    // 5. Check job counts
    try {
      const counts = await this.queue.getJobCounts();
      console.log('5. Job counts:', counts);
    } catch (error) {
      console.log('5. Error getting job counts:', error.message);
    }

    // 6. Check if we can add a test job
    try {
      const testJob = await this.queue.add(
        'debug-test',
        {
          postId: `debug-${Date.now()}`,
          debug: true,
          timestamp: new Date().toISOString(),
        },
        {
          delay: 0,
          removeOnComplete: true,
        },
      );
      console.log('6. Test job added:', testJob.id);

      // Check job state after a short delay
      setTimeout(async () => {
        const state = await testJob.getState();
        console.log('6. Test job state after 2s:', state);
      }, 2000);
    } catch (error) {
      console.log('6. Error adding test job:', error.message);
    }

    return {
      queueName: this.queue.name,
      redisStatus: (await this.queue.client).status,
      activeWorkers: workers.length,
      workers: workers,
      message: workers.length > 0 ? 'Worker connected!' : 'No workers found',
    };
  }
}
