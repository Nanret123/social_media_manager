import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from 'src/common/guards/organization.guard';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Req() req, @Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(
      req.user.id,
      createOrganizationDto,
    );
  }

  @Get(':id')
  @UseGuards(OrganizationGuard)
  findOne(@Param('id') id: string, @Req() req) {
    return this.organizationsService.getOrganization(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(OrganizationGuard)
  update(
    @Param('id') id: string,
    @Req() req,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(
      id,
      req.user.id,
      updateOrganizationDto,
    );
  }

  @Delete(':id')
  @UseGuards(OrganizationGuard)
  remove(@Param('id') id: string, @Req() req) {
    return this.organizationsService.deleteOrganization(id, req.user.id);
  }

  @Get(':id/usage')
  @UseGuards(OrganizationGuard)
  getUsage(@Param('id') id: string, @Req() req) {
    return this.organizationsService.getOrganizationUsage(id, req.user.id);
  }

  @Get(':id/stats')
  @UseGuards(OrganizationGuard)
  getStats(@Param('id') id: string, @Req() req) {
    return this.organizationsService.getOrganizationStats(id, req.user.id);
  }
}
