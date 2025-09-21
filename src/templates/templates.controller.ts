import { Controller } from '@nestjs/common';
import { TemplatesService } from './templates.service';

import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TemplateService } from './template.service';
import { 
  CreateTemplateDto, 
  UpdateTemplateDto, 
  TemplateSearchFilters,
  RenderTemplateOptions 
} from './template.types';

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  async createTemplate(
    @Body() createDto: CreateTemplateDto,
    @Query('userId') userId: string,
    @Query('organizationId') organizationId?: string
  ) {
    return this.templateService.createTemplate(createDto, userId, organizationId);
  }

  @Get()
  async findTemplates(
    @Query() filters: TemplateSearchFilters,
    @Query('organizationId') organizationId?: string
  ) {
    return this.templateService.findTemplates(filters, organizationId);
  }

  @Get(':id')
  async findTemplateById(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string
  ) {
    return this.templateService.findTemplateById(id, organizationId);
  }

  @Put(':id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() updateDto: UpdateTemplateDto,
    @Query('userId') userId: string
  ) {
    return this.templateService.updateTemplate(id, updateDto, userId);
  }

  @Delete(':id')
  async deleteTemplate(
    @Param('id') id: string,
    @Query('userId') userId: string
  ) {
    return this.templateService.deleteTemplate(id, userId);
  }

  @Post(':id/render')
  async renderTemplate(
    @Param('id') templateId: string,
    @Body() options: RenderTemplateOptions,
    @Query('organizationId') organizationId?: string
  ) {
    return this.templateService.renderTemplate(templateId, options, organizationId);
  }

  @Post(':id/duplicate')
  async duplicateTemplate(
    @Param('id') templateId: string,
    @Query('userId') userId: string,
    @Query('organizationId') organizationId?: string
  ) {
    return this.templateService.duplicateTemplate(templateId, userId, organizationId);
  }

  @Get('categories')
  async getCategories() {
    return this.templateService.getTemplateCategories();
  }

  @Get('tags/popular')
  async getPopularTags(@Query('limit') limit: number = 20) {
    return this.templateService.getPopularTags(limit);
  }

  @Get('stats')
  async getStats(@Query('organizationId') organizationId?: string) {
    return this.templateService.getTemplateStats(organizationId);
  }
}