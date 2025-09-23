import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import {
  OrganizationUsage,
  OrganizationStats,
} from './types/organization.types';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    // Check if slug is available
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    // Create organization and make user the owner
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          timezone: dto.timezone || 'UTC',
          billingEmail: dto.billingEmail,
          planTier: 'FREE',
          planStatus: 'ACTIVE',
          maxMembers: 5, // Default limit
          monthlyCreditLimit: 1000, // Default credits
        },
      });

      // Add user as owner
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: userId,
          role: 'OWNER',
          invitedBy: userId,
        },
      });

      // Create default brand kit
      await tx.brandKit.create({
        data: {
          organizationId: organization.id,
          name: 'Our Brand',
        },
      });

      return organization;
    });
  }

  async getOrganization(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
        isActive: true,
      },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: { where: { isActive: true } },
                posts: true,
                aiContentGenerations: true,
                aiImageGenerations: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return membership.organization;
  }

  async updateOrganization(
    orgId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.verifyOwnership(orgId, userId);

    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async deleteOrganization(orgId: string, userId: string) {
    await this.verifyOwnership(orgId, userId);

    // Soft delete organization and related data
    return this.prisma.$transaction(async (tx) => {
      // Deactivate organization
      await tx.organization.update({
        where: { id: orgId },
        data: { isActive: false },
      });

      // Deactivate all members
      await tx.organizationMember.updateMany({
        where: { organizationId: orgId },
        data: { isActive: false },
      });

      // Cancel any active subscriptions
      // This would integrate with your billing service
      await this.cancelSubscription(orgId);

      return { success: true, message: 'Organization deleted successfully' };
    });
  }

  async getOrganizationUsage(
    orgId: string,
    userId: string,
  ): Promise<OrganizationUsage> {
    await this.verifyMembership(orgId, userId);

    const [organization, memberCount, creditUsage, postCount, mediaStorage] =
      await Promise.all([
        this.prisma.organization.findUnique({ where: { id: orgId } }),
        this.prisma.organizationMember.count({
          where: { organizationId: orgId, isActive: true },
        }),
        this.prisma.aIUsage.aggregate({
          where: { organizationId: orgId },
          _sum: { tokensUsed: true },
        }),
        this.prisma.post.count({ where: { organizationId: orgId } }),
        this.prisma.mediaFile.aggregate({
          where: { organizationId: orgId },
          _sum: { size: true },
        }),
      ]);

    return {
      memberCount,
      creditUsage: creditUsage._sum.tokensUsed || 0,
      postCount,
      mediaStorage: mediaStorage._sum.size || 0,
      maxMembers: organization.maxMembers,
      monthlyCreditLimit: organization.monthlyCreditLimit,
    };
  }

  async getOrganizationStats(
    orgId: string,
    userId: string,
  ): Promise<OrganizationStats> {
    await this.verifyMembership(orgId, userId);

    const stats = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            members: { where: { isActive: true } },
            posts: true,
            aiContentGenerations: true,
            aiImageGenerations: true,
          },
        },
        posts: {
          select: {
            analytics: {
              select: {
                likes: true,
                comments: true,
                shares: true,
                impressions: true,
              },
            },
          },
        },
      },
    });

    const totalEngagement = stats.posts.reduce((sum, post) => {
      const postEngagement = post.analytics.reduce(
        (acc, a) => acc + (a.likes + a.comments + a.shares),
        0,
      );
      return sum + postEngagement;
    }, 0);

    const totalImpressions = stats.posts.reduce((sum, post) => {
      const postImpressions = post.analytics.reduce(
        (acc, a) => acc + a.impressions,
        0,
      );
      return sum + postImpressions;
    }, 0);

    const engagementRate =
      totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

    return {
      totalPosts: stats._count.posts,
      scheduledPosts: 0, // You'd need to track this separately
      aiGenerations:
        stats._count.aiContentGenerations + stats._count.aiImageGenerations,
      teamMembers: stats._count.members,
      engagementRate: parseFloat(engagementRate.toFixed(2)),
    };
  }

  async checkMemberLimit(orgId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxMembers: true },
    });

    const memberCount = await this.prisma.organizationMember.count({
      where: { organizationId: orgId, isActive: true },
    });

    return memberCount < organization.maxMembers;
  }

  private async verifyOwnership(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
        role: 'OWNER',
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Only organization owners can perform this action',
      );
    }
  }

  private async verifyMembership(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Organization access denied');
    }
  }

  private async cancelSubscription(orgId: string) {
    // Integrate with your billing service (Stripe, etc.)
    // This is a placeholder implementation
    console.log(`Canceling subscription for organization ${orgId}`);
  }
}
