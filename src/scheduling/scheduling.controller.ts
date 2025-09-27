import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { SchedulePostData, SchedulingService } from './scheduling.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Scheduling')
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a post job in the queue' })
  @ApiResponse({ status: 201, description: 'Job scheduled successfully' })
  async schedulePost(@Body() data: SchedulePostData) {
    return this.schedulingService.schedulePost(data);
  }

  @Post('publish-now')
  @ApiOperation({ summary: 'Publish a post immediately via scheduler' })
  async publishImmediately(
    @Body() data: Omit<SchedulePostData, 'scheduledAt'>,
  ) {
    return this.schedulingService.publishImmediately(data);
  }

  @Delete(':jobId')
  @ApiOperation({ summary: 'Cancel a scheduled job' })
  async cancelScheduledPost(@Param('jobId') jobId: string) {
    return this.schedulingService.cancelScheduledPost(jobId);
  }
}
