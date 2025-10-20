import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApprovalRequestDto } from './dtos/approval-request.dto';
import { ApprovalActionDto } from './dtos/approval-action.dto';
import { GetApprovalsFilterDto } from './dtos/get-approval.dto';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('post/approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request approval for a draft post' })
  @ApiResponse({ status: 201, description: 'Approval request created' })
  async requestApproval(@Body() dto: ApprovalRequestDto, @Req() req) {
    return this.approvalsService.createApprovalRequest(
      dto.postId,
      req.user.id,
    );
  }

  @Post(':postId/approve')
  @ApiOperation({ summary: 'Approve a pending post' })
  @ApiResponse({ status: 200, description: 'Post approved' })
  async approvePost(@Param('postId') postId: string,  @Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.approvePost(
      postId,
      req.user.id,
      dto.comments,
    );
  }

  @Post(':postId/reject')
  @ApiOperation({ summary: 'Reject a pending post' })
  @ApiResponse({ status: 200, description: 'Post rejected' })
  async rejectPost(@Param('postId') postId: string, @Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.rejectPost(
      postId,
      req.user.id,
      dto.comments,
      dto.revisionNotes,
    );
  }

  @Post(':postId/request-changes')
  @ApiOperation({ summary: 'Request changes for a pending post' })
  @ApiResponse({ status: 200, description: 'Changes requested' })
  async requestChanges(@Param('postId') postId: string, @Body() dto: ApprovalActionDto, @Req() req) {
    return this.approvalsService.requestChanges(
      postId,
      req.user.id,
      dto.comments,
      dto.revisionNotes,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all approvals with optional filters',
    description:
      'Retrieve all approvals with pagination and filtering options. Includes related post, requester, and approver data.',
  })
  async getApprovals(
    @Param('organizationId') organizationId: string,
    @Query() filters: GetApprovalsFilterDto,
  ) {
    return this.approvalsService.getApprovals(organizationId, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific approval by ID',
    description:
      'Retrieve full approval details including post, requester, and approver information.',
  })
  @ApiParam({ name: 'id', description: 'Approval ID', type: String })
  async getApprovalById(@Param('id') id: string, @Param('organizationId') organizationId: string,) {
    return this.approvalsService.getApprovalById(id, organizationId);
  }
}
