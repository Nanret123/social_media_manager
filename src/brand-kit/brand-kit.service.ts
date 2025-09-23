import { Injectable } from '@nestjs/common';
import { BrandKit } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BrandKitService {
  private readonly cache = new Map<string, BrandKit>();

  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, data: CreateBrandKitDto) {
    // Deactivate any existing active brand kit
    await this.prisma.brandKit.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.brandKit.create({
      data: {
        organizationId,
        name: data.name || 'Our Brand',
        logoUrl: data.logoUrl,
        colors: data.colors,
        brandVoice: data.brandVoice,
        tone: data.tone,
        socialHandles: data.socialHandles,
        guidelines: data.guidelines,
        isActive: true,
        isDefault: data.isDefault || false,
      },
    });
  }

  async findByOrganization(organizationId: string, includeInactive = false) {
    const where: any = { organizationId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.brandKit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveBrandKit(organizationId: string): Promise<BrandKit | null> {
    const cacheKey = `brandkit:${organizationId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const brandKit = await this.prisma.brandKit.findFirst({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (brandKit) {
      this.cache.set(cacheKey, brandKit);
      // Cache for 5 minutes
      setTimeout(() => this.cache.delete(cacheKey), 300000);
    }

    return brandKit;
  }

  async update(id: string, organizationId: string, data: UpdateBrandKitDto) {
    return this.prisma.brandKit.update({
      where: { id, organizationId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async deactivate(id: string, organizationId: string) {
    return this.prisma.brandKit.update({
      where: { id, organizationId },
      data: { isActive: false },
    });
  }

  async activate(id: string, organizationId: string) {
    // Deactivate all others first
    await this.prisma.brandKit.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.brandKit.update({
      where: { id, organizationId },
      data: { isActive: true },
    });
  }
}
