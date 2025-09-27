import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApprovalRequestDto } from './dtos/approval-request.dto';
import { ApprovalActionDto } from './dtos/approval-action.dto';

@ApiTags('Approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request approval for a draft post' })
  @ApiResponse({ status: 201, description: 'Approval request created' })
  async requestApproval(@Body() dto: ApprovalRequestDto, @Req() req) {
    return this.approvalsService.requestApproval(
      dto.postId,
      req.user.id,
      dto.organizationId,
    );
  }

  @Post('approve')
  @ApiOperation({ summary: 'Approve a pending post' })
  @ApiResponse({ status: 200, description: 'Post approved' })
  async approvePost(@Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.approvePost(
      dto.postId,
      req.user.id,
      dto.comments,
    );
  }

  @Post('reject')
  @ApiOperation({ summary: 'Reject a pending post' })
  @ApiResponse({ status: 200, description: 'Post rejected' })
  async rejectPost(@Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.rejectPost(
      dto.postId,
      req.user.id,
      dto.comments,
      dto.revisionNotes,
    );
  }

  @Post('request-changes')
  @ApiOperation({ summary: 'Request changes for a pending post' })
  @ApiResponse({ status: 200, description: 'Changes requested' })
  async requestChanges(@Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.requestChanges(
      dto.postId,
      req.user.id,
      dto.comments,
      dto.revisionNotes,
    );
  }

  @Get('pending/:organizationId')
  @ApiOperation({ summary: 'Get pending approvals for an organization' })
  @ApiResponse({ status: 200, description: 'List of pending approvals' })
  async getPendingApprovals(
    @Param('organizationId') organizationId: string,
    @Query('approverId') approverId?: string,
  ) {
    return this.approvalsService.getPendingApprovals(
      organizationId,
      approverId,
    );
  }
}
