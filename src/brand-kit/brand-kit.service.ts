import { Injectable } from '@nestjs/common';
import { BrandKit } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CreateBrandKitDto, UpdateBrandKitDto } from './dtos/create-brand-kit.dto';

@Injectable()
export class BrandKitService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService, // Redis integration
  ) {}

  private getCacheKey(organizationId: string) {
    return `brandkit:${organizationId}`;
  }

  /** Create a new brand kit and set it as active */
  async create(organizationId: string, data: CreateBrandKitDto) {
    // Deactivate existing active brand kits
    await this.prisma.brandKit.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    const brandKit = await this.prisma.brandKit.create({
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

    // Cache the active brand kit in Redis for 5 minutes
    await this.redisService.set(
      this.getCacheKey(organizationId),
      JSON.stringify(brandKit),
      300,
    );

    return brandKit;
  }

  /** Get all brand kits for an organization */
  async findByOrganization(organizationId: string, includeInactive = false) {
    const where: any = { organizationId };
    if (!includeInactive) where.isActive = true;

    return this.prisma.brandKit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get the currently active brand kit (with Redis caching) */
  async getActiveBrandKit(organizationId: string): Promise<BrandKit | null> {
    const cacheKey = this.getCacheKey(organizationId);

    // Check Redis first
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as BrandKit;

    // Fallback: fetch from DB
    const brandKit = await this.prisma.brandKit.findFirst({
      where: { organizationId, isActive: true, deletedAt: null },
    });

    if (brandKit) {
      await this.redisService.set(cacheKey, JSON.stringify(brandKit), 300);
    }

    return brandKit;
  }

  /** Update a brand kit */
  async update(id: string, organizationId: string, data: UpdateBrandKitDto) {
    const updated = await this.prisma.brandKit.update({
      where: { id, organizationId },
      data: { ...data, updatedAt: new Date() },
    });

    // If updated brand kit is active, refresh Redis cache
    if (updated.isActive) {
      await this.redisService.set(
        this.getCacheKey(organizationId),
        JSON.stringify(updated),
        300,
      );
    }

    return updated;
  }

  /** Get brand kit by ID */
  async getById(id: string, organizationId?: string): Promise<BrandKit | null> {
    const where: any = { id, deletedAt: null };
    if (organizationId) where.organizationId = organizationId;

    return this.prisma.brandKit.findFirst({ where });
  }

  /** Deactivate a brand kit */
  async deactivate(id: string, organizationId: string) {
    const updated = await this.prisma.brandKit.update({
      where: { id, organizationId },
      data: { isActive: false },
    });

    // Remove from Redis cache
    await this.redisService.del(this.getCacheKey(organizationId));

    return updated;
  }

  /** Activate a brand kit and deactivate others */
  async activate(id: string, organizationId: string) {
    // Deactivate all others first
    await this.prisma.brandKit.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    const updated = await this.prisma.brandKit.update({
      where: { id, organizationId },
      data: { isActive: true },
    });

    // Update Redis cache
    await this.redisService.set(
      this.getCacheKey(organizationId),
      JSON.stringify(updated),
      300,
    );

    return updated;
  }
}
