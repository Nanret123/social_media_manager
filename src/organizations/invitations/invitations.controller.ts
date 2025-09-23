import {
  Controller,
  UseGuards,
  Post,
  Param,
  Body,
  Get,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from 'src/common/guards/organization.guard';
import { InviteMemberDto } from './dtos/invite-member.dto';
import { InvitationsService } from './invitations.service';

@Controller('organizations/:orgId/invitations')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  inviteMember(
    @Param('orgId') orgId: string,
    @Req() req,
    @Body() inviteMemberDto: InviteMemberDto,
  ) {
    return this.invitationsService.inviteMember(
      orgId,
      req.user.id,
      inviteMemberDto,
    );
  }

  @Get()
  getInvitations(@Param('orgId') orgId: string) {
    return this.invitationsService.getOrganizationInvitations(orgId);
  }

  @Patch(':invitationId/resend')
  resendInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @Req() req,
  ) {
    return this.invitationsService.resendInvitation(invitationId, req.user.id);
  }

  @Delete(':invitationId')
  revokeInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @Req() req,
  ) {
    return this.invitationsService.revokeInvitation(invitationId, req.user.id);
  }
}

// Separate controller for accepting invitations
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsAcceptController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post(':token/accept')
  acceptInvitation(@Param('token') token: string, @Req() req) {
    return this.invitationsService.acceptInvitation(token, req.user.id);
  }
}
