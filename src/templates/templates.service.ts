import { Injectable } from '@nestjs/common';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { 
  CreateTemplateDto, 
  UpdateTemplateDto, 
  TemplateSearchFilters,
  RenderTemplateOptions,
  TemplateRenderResult,
  TemplateCategory 
} from './template.types';
import { TemplateEngine } from './template-engine';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateEngine: TemplateEngine,
  ) {}

  async createTemplate(createDto: CreateTemplateDto, userId: string, organizationId?: string) {
    const template = await this.prisma.contentTemplate.create({
      data: {
        ...createDto,
        userId,
        organizationId,
        content: createDto.content as any, // JSON conversion handled by Prisma
      },
    });

    this.logger.log(`Template created: ${template.name} by user ${userId}`);
    return template;
  }

  async findTemplates(filters: TemplateSearchFilters, organizationId?: string) {
    const where: any = {};

    if (organizationId !== undefined) {
      where.OR = [
        { organizationId }, // Organization templates
        { isPublic: true }, // Public templates
        { organizationId: null } // System templates
      ];
    } else {
      where.isPublic = true;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.platform) {
      where.platform = filters.platform;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }

    const templates = await this.prisma.contentTemplate.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        },
        organization: {
          select: { name: true }
        }
      },
      orderBy: { usageCount: 'desc' },
    });

    return templates;
  }

  async findTemplateById(id: string, organizationId?: string) {
    const template = await this.prisma.contentTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizationId },
          { isPublic: true },
          { organizationId: null }
        ]
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async updateTemplate(id: string, updateDto: UpdateTemplateDto, userId: string) {
    const template = await this.prisma.contentTemplate.findFirst({
      where: { id, userId } // Users can only update their own templates
    });

    if (!template) {
      throw new NotFoundException('Template not found or access denied');
    }

    const updated = await this.prisma.contentTemplate.update({
      where: { id },
      data: {
        ...updateDto,
        content: updateDto.content as any,
      },
    });

    this.logger.log(`Template updated: ${id} by user ${userId}`);
    return updated;
  }

  async deleteTemplate(id: string, userId: string) {
    const template = await this.prisma.contentTemplate.findFirst({
      where: { id, userId }
    });

    if (!template) {
      throw new NotFoundException('Template not found or access denied');
    }

    await this.prisma.contentTemplate.delete({
      where: { id },
    });

    this.logger.log(`Template deleted: ${id} by user ${userId}`);
    return { success: true };
  }

  async renderTemplate(
    templateId: string, 
    options: RenderTemplateOptions,
    organizationId?: string
  ): Promise<TemplateRenderResult> {
    const template = await this.findTemplateById(templateId, organizationId);
    const result = await this.templateEngine.renderTemplate(
      template.content as any,
      options
    );

    if (result.isValid) {
      // Increment usage count
      await this.prisma.contentTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return result;
  }

  async duplicateTemplate(templateId: string, userId: string, organizationId?: string) {
    const template = await this.findTemplateById(templateId, organizationId);
    
    const duplicated = await this.prisma.contentTemplate.create({
      data: {
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category as TemplateCategory,
        platform: template.platform,
        content: template.content,
        tags: template.tags,
        isPublic: false, // Duplicates are always private
        status: 'draft',
        userId,
        organizationId,
      },
    });

    this.logger.log(`Template duplicated: ${templateId} -> ${duplicated.id} by user ${userId}`);
    return duplicated;
  }

  async getTemplateCategories(): Promise<TemplateCategory[]> {
    return Object.values(TemplateCategory);
  }

  async getPopularTags(limit: number = 20): Promise<string[]> {
    const templates = await this.prisma.contentTemplate.findMany({
      where: { isPublic: true, status: 'published' },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    templates.forEach(template => {
      template.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  async getTemplateStats(organizationId?: string) {
    const where = organizationId ? { organizationId } : { isPublic: true };

    const stats = await this.prisma.contentTemplate.groupBy({
      by: ['platform', 'category'],
      where,
      _count: { id: true },
      _avg: { usageCount: true },
    });

    return stats;
  }
}