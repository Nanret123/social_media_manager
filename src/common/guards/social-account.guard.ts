import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/permissions.decorator';

@Injectable()
export class SocialAccountGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return false;
    }

    const socialAccountId = request.params.socialAccountId || request.body.socialAccountId;
    const organizationId = request.params.organizationId || request.body.organizationId;

    if (!socialAccountId) {
      throw new BadRequestException('Social Account ID is required');
    }

    // First check if user has access to the social account directly
    const socialAccountMembership = await this.prisma.socialAccountMember.findUnique({
      where: {
        socialAccountId_userId: {
          socialAccountId,
          userId: user.id,
        },
      },
      select: {
        isActive: true,
        socialAccount: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (socialAccountMembership?.isActive) {
      return true;
    }

    // If no direct access, check organization membership
    if (!organizationId) {
      // Try to get organization from social account
      const socialAccount = await this.prisma.socialAccount.findUnique({
        where: { id: socialAccountId },
        select: { organizationId: true },
      });

      if (!socialAccount) {
        throw new ForbiddenException('Social account not found');
      }

      request.params.organizationId = socialAccount.organizationId;
    }

    // Check organization membership
    const orgMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organizationId || socialAccountMembership?.socialAccount.organizationId,
          userId: user.id,
        },
      },
      select: {
        isActive: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!orgMembership?.isActive) {
      throw new ForbiddenException('User does not have access to this social account');
    }

    // Organization owners and editors have access to all social accounts in the organization
    if (['owner', 'editor'].includes(orgMembership.role.name)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions for this social account');
  }
}