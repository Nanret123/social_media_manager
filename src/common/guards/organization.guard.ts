// common/guards/organization.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Get the required roles from the custom decorator (see next step)
    const requiredRoles = this.reflector.get<OrganizationRole[]>(
      'organizationRoles',
      context.getHandler(),
    ) || []; // If no roles are specified, just require membership

    // 2. Get the request object
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id; // Assuming user is attached from an AuthGuard
    const organizationId = request.params.orgId; // e.g., from a route like '/orgs/:orgId/...'

    if (!organizationId) {
      throw new ForbiddenException('Organization ID not found in request');
    }

    // 3. Check the user's membership and role
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        organization: { isActive: true }, // Check for active org
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // 4. If specific roles are required, check them
    if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    // 5. Attach the membership to the request for use in the controller/service
    // This is powerful! Now we don't have to query the DB again.
    request.organizationMembership = membership;

    return true;
  }
}