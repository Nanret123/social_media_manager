import { Controller, Request, Body, Param, Post, Get, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationRoles } from '../common/decorators/organization-roles.decorator';
import { OrganizationService } from './organization.service';
import { OrganizationRole } from '@prisma/client';
import { CreateOrganization } from './dtos/create-organization.dto';
import { UpdateOrganization } from './dtos/update-organization.dto';
import { UpdateMemberRole } from './dtos/organization-member.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  async createOrganization(@Request() req, @Body() createDto: CreateOrganization) {
    return this.organizationService.createOrganization(req.user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations where the user is a member' })
  async getMyOrganizations(@Request() req) {
    return this.organizationService.getOrganizationsByUser(req.user.id);
  }

  @Get(':orgId')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get details of a specific organization' })
  async getOrganization(@Param('orgId') orgId: string, @Request() req) {
    // Guard ensures access. No need to pass userId.
    return this.organizationService.getOrganizationById(orgId, req.user.id);
  }

  @Put(':orgId')
  @UseGuards(OrganizationGuard)
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Update organization details' })
  async updateOrganization(
    @Param('orgId') orgId: string,
    @Body() updateDto: UpdateOrganization,
  ) {
    return this.organizationService.updateOrganization(orgId, updateDto);
  }

  @Delete(':orgId')
  @UseGuards(OrganizationGuard)
  @OrganizationRoles(OrganizationRole.OWNER) 
  @ApiOperation({ summary: 'Delete an organization' })
  async deleteOrganization(@Param('orgId') orgId: string) {
    return this.organizationService.deleteOrganization(orgId);
  }

  @Put(':orgId/members/:memberId/role')
  @UseGuards(OrganizationGuard)
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Update a member’s role in the organization' })
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateMemberRole,
  ) {
    return this.organizationService.updateMemberRole(orgId, memberId, updateDto);
  }

  @Delete(':orgId/members/:memberId')
  @UseGuards(OrganizationGuard)
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member from the organization' })
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationService.removeMember(orgId, memberId);
  }

  @Post(':orgId/leave')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Leave the organization (self-removal)' })
  async leaveOrganization(@Param('orgId') orgId: string, @Request() req) {
    return this.organizationService.leaveOrganization(orgId, req.user.id);
  }
}