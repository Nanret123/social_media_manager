import {
  Controller,
  UseGuards,
  Get,
  Param,
  Patch,
  Body,
  Delete,
  Post,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from 'src/common/guards/organization.guard';
import { UpdateMemberDto } from '../invitations/dtos/update-member.dto';
import { MembersService } from './members.service';

@Controller('organizations/:orgId/members')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  getMembers(@Param('orgId') orgId: string, @Req() req) {
    return this.membersService.getOrganizationMembers(orgId, req.user.id);
  }

  @Patch(':memberId')
  updateMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Req() req,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(
      orgId,
      memberId,
      req.user.id,
      updateMemberDto,
    );
  }

  @Delete(':memberId')
  removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    return this.membersService.removeMember(orgId, memberId, req.user.id);
  }

  @Post('leave')
  leaveOrganization(@Param('orgId') orgId: string, @Req() req) {
    return this.membersService.leaveOrganization(orgId, req.user.id);
  }

  @Post('transfer-ownership')
  transferOwnership(
    @Param('orgId') orgId: string,
    @Req() req,
    @Body() body: { newOwnerMemberId: string },
  ) {
    return this.membersService.transferOwnership(
      orgId,
      req.user.id,
      body.newOwnerMemberId,
    );
  }
}
