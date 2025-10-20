import { Controller, Delete, Param } from '@nestjs/common';
import { SocialSchedulerService } from './social-scheduler.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Social Scheduler')
@Controller('social-scheduler')
@ApiBearerAuth()
export class SocialSchedulerController {
  constructor(private readonly service: SocialSchedulerService) {}

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
  async cancelScheduledPost(@Param('postId') postId: string, @Param('organizationId') organizationId: string) {
    return this.service.cancelScheduledPost(postId, organizationId);
  }
}
