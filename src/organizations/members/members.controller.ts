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
import { UpdateMemberDto } from './dtos/update-member.dto';
import { MembersService } from './members.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Organization Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations/:orgId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active members in an organization' })
  @ApiResponse({
    status: 200,
    description: 'List of organization members returned',
  })
  async getMembers(@Param('orgId') orgId: string, @Req() req) {
    return this.membersService.getOrganizationMembers(orgId, req.user.id);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: 'Update member role, status, or permissions' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  async updateMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Req() req,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(orgId, memberId, req.user.id, dto);
  }

  @Delete(':memberId')
  @ApiOperation({
    summary: 'Remove a member from the organization (soft delete)',
  })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    return this.membersService.removeMember(orgId, memberId, req.user.id);
  }

  @Post('leave')
  @ApiOperation({ summary: 'Leave the organization (for non-owners)' })
  @ApiResponse({ status: 200, description: 'Successfully left organization' })
  async leaveOrganization(@Param('orgId') orgId: string, @Req() req) {
    return this.membersService.leaveOrganization(orgId, req.user.id);
  }

  @Post('transfer-ownership/:newOwnerMemberId')
  @ApiOperation({
    summary: 'Transfer organization ownership to another member',
  })
  @ApiResponse({
    status: 200,
    description: 'Ownership transferred successfully',
  })
  async transferOwnership(
    @Param('orgId') orgId: string,
    @Param('newOwnerMemberId') newOwnerMemberId: string,
    @Req() req,
  ) {
    return this.membersService.transferOwnership(
      orgId,
      req.user.id,
      newOwnerMemberId,
    );
  }
}
