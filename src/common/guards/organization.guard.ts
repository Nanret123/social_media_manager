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
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return false;
    }

    const organizationId = request.params.organizationId || request.body.organizationId;

    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    // Check if user is a member of the organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      select: {
        isActive: true,
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    return true;
  }
}