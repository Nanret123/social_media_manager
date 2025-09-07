import {
  Controller,
  UseGuards,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvitationService } from './invitations.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InviteUser } from './dtos/invite-user.dto';
import { AcceptInvitation } from './dtos/accept-invitation.dto';


@ApiTags('Invitations')
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  @Post(':orgId/invite')
  @ApiOperation({ summary: 'Invite a user to an organization' })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  async inviteUser(
    @Param('orgId') orgId: string,
    @Request() req,
    @Body() inviteDto: InviteUser,
  ) {
    return this.invitationService.inviteUser(orgId, req.user.id, inviteDto);
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  async acceptInvitation(
    @Request() req,
    @Body() acceptDto: AcceptInvitation,
  ) {
    return this.invitationService.acceptInvitation(acceptDto.token, req.user.id);
  }

  @Post('decline/:token')
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation declined successfully' })
  async declineInvitation(@Param('token') token: string) {
    return this.invitationService.declineInvitation(token);
  }

  @Get(':orgId/pending')
  @ApiOperation({ summary: 'Get pending invitations for an organization' })
  @ApiResponse({ status: 200, description: 'List of pending invitations' })
  async getPendingInvitations(@Param('orgId') orgId: string) {
    return this.invitationService.getPendingInvitations(orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled successfully' })
  async cancelInvitation(@Param('id') invitationId: string, @Request() req) {
    return this.invitationService.cancelInvitation(invitationId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation email' })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  async resendInvitation(@Param('id') invitationId: string, @Request() req) {
    return this.invitationService.resendInvitation(invitationId, req.user.id);
  }

  @Get('my-invitations')
  @ApiOperation({ summary: 'Get my pending invitations' })
  @ApiResponse({ status: 200, description: 'List of invitations for the current user' })
  async getMyInvitations(@Request() req) {
    return this.invitationService.getMyInvitations(req.user.email);
  }
}
