import { Injectable } from '@nestjs/common';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { 
  CreateBrandKitDto, 
  UpdateBrandKitDto, 
  BrandColor,
  BrandFont,
  SocialHandles 
} from './brand-kit.types';
import { BrandValidator } from './brand-validator';

@Injectable()
export class BrandKitService {
  private readonly logger = new Logger(BrandKitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandValidator: BrandValidator,
  ) {}

  async createBrandKit(organizationId: string, createDto: CreateBrandKitDto) {
    // Validate brand kit data
    const validation = await this.brandValidator.validateBrandKit(createDto);
    if (!validation.isValid) {
      throw new Error(`Invalid brand kit: ${validation.issues.join(', ')}`);
    }

    const brandKit = await this.prisma.brandKit.create({
      data: {
        organizationId,
        name: createDto.name,
        description: createDto.description,
        logoUrl: createDto.logoUrl,
        faviconUrl: createDto.faviconUrl,
        brandVoice: createDto.brandVoice,
        brandWords: createDto.brandWords,
        bannedWords: createDto.bannedWords,
        socialHandles: createDto.socialHandles as any,
        websiteUrl: createDto.websiteUrl,
        colors: {
          create: createDto.colors.map((color, index) => ({
            name: color.name,
            value: color.value,
            type: color.type,
            order: index,
          })),
        },
        fonts: {
          create: createDto.fonts.map(font => ({
            name: font.name,
            category: font.category,
            weight: font.weight,
            isCustom: font.isCustom,
            customUrl: font.customUrl,
          })),
        },
      },
      include: {
        colors: true,
        fonts: true,
      },
    });

    this.logger.log(`Brand kit created for organization ${organizationId}`);
    return brandKit;
  }

  async getBrandKit(organizationId: string) {
    const brandKit = await this.prisma.brandKit.findUnique({
      where: { organizationId },
      include: {
        colors: { orderBy: { order: 'asc' } },
        fonts: true,
        organization: {
          select: { name: true, id: true }
        }
      }
    });

    if (!brandKit) {
      throw new NotFoundException('Brand kit not found');
    }

    return brandKit;
  }

  async updateBrandKit(organizationId: string, updateDto: UpdateBrandKitDto) {
    const existingKit = await this.getBrandKit(organizationId);

    // Validate updates if provided
    if (updateDto.colors || updateDto.fonts) {
      const validation = await this.brandValidator.validateBrandKit(updateDto as CreateBrandKitDto);
      if (!validation.isValid) {
        throw new Error(`Invalid brand kit updates: ${validation.issues.join(', ')}`);
      }
    }

    const updatedKit = await this.prisma.brandKit.update({
      where: { organizationId },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        logoUrl: updateDto.logoUrl,
        faviconUrl: updateDto.faviconUrl,
        brandVoice: updateDto.brandVoice,
        brandWords: updateDto.brandWords,
        bannedWords: updateDto.bannedWords,
        socialHandles: updateDto.socialHandles as any,
        websiteUrl: updateDto.websiteUrl,
        isActive: updateDto.isActive,
        ...(updateDto.colors && {
          colors: {
            deleteMany: {}, // Remove existing colors
            create: updateDto.colors.map((color, index) => ({
              name: color.name,
              value: color.value,
              type: color.type,
              order: index,
            })),
          },
        }),
        ...(updateDto.fonts && {
          fonts: {
            deleteMany: {}, // Remove existing fonts
            create: updateDto.fonts.map(font => ({
              name: font.name,
              category: font.category,
              weight: font.weight,
              isCustom: font.isCustom,
              customUrl: font.customUrl,
            })),
          },
        }),
      },
      include: {
        colors: { orderBy: { order: 'asc' } },
        fonts: true,
      },
    });

    this.logger.log(`Brand kit updated for organization ${organizationId}`);
    return updatedKit;
  }

  async deleteBrandKit(organizationId: string) {
    await this.prisma.brandKit.delete({
      where: { organizationId },
    });

    this.logger.log(`Brand kit deleted for organization ${organizationId}`);
    return { success: true };
  }

  async getBrandKitForAI(organizationId: string) {
    const brandKit = await this.getBrandKit(organizationId);
    
    // Format for AI consumption
    return {
      colors: brandKit.colors.reduce((acc, color) => {
        acc[color.type.toLowerCase()] = color.value;
        return acc;
      }, {} as Record<string, string>),
      voice: brandKit.brandVoice,
      keywords: brandKit.brandWords,
      avoidWords: brandKit.bannedWords,
      fonts: brandKit.fonts.reduce((acc, font) => {
        acc[font.category.toLowerCase()] = font.name;
        return acc;
      }, {} as Record<string, string>),
    };
  }

  async validateContentAgainstBrand(
    organizationId: string, 
    content: string
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    const brandKit = await this.getBrandKit(organizationId);
    return this.brandValidator.validateContent(content, brandKit);
  }

  async getBrandUsage(organizationId: string) {
    const brandKit = await this.getBrandKit(organizationId);
    
    const usage = await this.prisma.aIGeneration.count({
      where: {
        organizationId,
        brandKitId: brandKit.id,
      },
    });

    return {
      totalGenerations: usage,
      lastUsed: brandKit.updatedAt,
      isActive: brandKit.isActive,
    };
  }
}