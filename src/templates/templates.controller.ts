import {
  UseGuards,
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  Query,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ContentTemplatesService } from './templates.service';
import { CreateTemplateDto } from './dtos/create-template.dto';
import { GenerateFromTemplateDto } from './dtos/generate-from-template.dto';
import { UpdateTemplateDto } from './dtos/update-template.dto';

@ApiTags('Content Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class ContentTemplatesController {
  constructor(private readonly templatesService: ContentTemplatesService) {}

  // CREATE
  @Post()
  @ApiOperation({ summary: 'Create a new template' })
  @ApiResponse({ status: 201, description: 'Template successfully created' })
  create(
    @Body() dto: CreateTemplateDto,
    @Req() req: any, // assume req.user contains { id, organizationId }
  ) {
    return this.templatesService.createTemplate(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  // GET ONE
  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template details returned' })
  getOne(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.getTemplateById(id, req.user.organizationId);
  }

  // GET ORG TEMPLATES
  @Get()
  @ApiOperation({ summary: 'List organization templates' })
  getOrgTemplates(@Req() req: any, @Query() query: any) {
    return this.templatesService.getOrganizationTemplates(
      req.user.organizationId,
      query,
    );
  }

  // GET SYSTEM TEMPLATES
  @Get('system/all')
  @ApiOperation({ summary: 'List system templates' })
  getSystemTemplates(@Query() query: any) {
    return this.templatesService.getSystemTemplates(query);
  }

  // UPDATE
  @Put(':id')
  @ApiOperation({ summary: 'Update a template' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: any,
  ) {
    return this.templatesService.updateTemplate(
      id,
      req.user.organizationId,
      dto,
    );
  }

  // DELETE
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a template (soft delete)' })
  delete(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.deleteTemplate(id, req.user.organizationId);
  }

  // GENERATE FROM TEMPLATE
  @Post(':id/generate')
  @ApiOperation({ summary: 'Generate content from a template' })
  generateFromTemplate(
    @Param('id') id: string,
    @Body() dto: GenerateFromTemplateDto,
    @Req() req: any,
  ) {
    // attach templateId to DTO for service
    dto.templateId = id;
    return this.templatesService.generateFromTemplate(
      dto,
      req.user.organizationId,
      req.user.id,
    );
  }

  // FAVORITE
  @Post(':id/favorite')
  @ApiOperation({ summary: 'Favorite a template' })
  favorite(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.favoriteTemplate(id, req.user.id);
  }

  // UNFAVORITE
  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Unfavorite a template' })
  unfavorite(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.unfavoriteTemplate(id, req.user.id);
  }

  // USER FAVORITES
  @Get('user/favorites')
  @ApiOperation({ summary: 'Get user favorite templates' })
  getUserFavorites(@Req() req: any) {
    return this.templatesService.getUserFavorites(
      req.user.id,
      req.user.organizationId,
    );
  }

  // DUPLICATE
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template' })
  duplicate(
    @Param('id') id: string,
    @Body('newName') newName: string,
    @Req() req: any,
  ) {
    return this.templatesService.duplicateTemplate(
      id,
      req.user.id,
      req.user.organizationId,
      newName,
    );
  }

  // ANALYTICS
  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get analytics for a template' })
  getAnalytics(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.getTemplateAnalytics(
      id,
      req.user.organizationId,
    );
  }
}
