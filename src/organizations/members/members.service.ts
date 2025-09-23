import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateMemberDto } from '../invitations/dtos/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationMembers(orgId: string, userId: string) {
    await this.verifyMembership(orgId, userId);

    return this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            lastActiveAt: true,
          },
        },
        inviter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async updateMember(
    orgId: string,
    memberId: string,
    updaterId: string,
    dto: UpdateMemberDto,
  ) {
    await this.verifyAdminAccess(orgId, updaterId);

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId, isActive: true },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Prevent modifying owners
    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Cannot modify organization owner');
    }

    // Prevent non-owners from assigning OWNER role
    if (dto.role === 'OWNER') {
      const updaterMembership = await this.getMembership(orgId, updaterId);
      if (updaterMembership.role !== 'OWNER') {
        throw new ForbiddenException('Only owners can assign owner role');
      }
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        role: dto.role,
        isActive: dto.isActive,
        permissions: dto.permissions,
      },
    });
  }

  async removeMember(orgId: string, memberId: string, removerId: string) {
    await this.verifyAdminAccess(orgId, removerId);

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId, isActive: true },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Prevent removing yourself
    if (targetMember.userId === removerId) {
      throw new ConflictException('Cannot remove yourself from organization');
    }

    // Prevent removing owners
    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove organization owner');
    }

    // Soft delete the member
    const updatedMember = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // Log to audit trail
    await this.logAuditEvent(orgId, removerId, 'member_removed', {
      removedMemberId: memberId,
      removedMemberEmail: targetMember.userId, // You'd need to join user table for email
    });

    return updatedMember;
  }

  async leaveOrganization(orgId: string, userId: string) {
    const membership = await this.getMembership(orgId, userId);

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Prevent owner from leaving (they should transfer ownership first)
    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Organization owner cannot leave. Transfer ownership first.',
      );
    }

    // Soft delete the membership
    await this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: { isActive: false },
    });

    // Log to audit trail
    await this.logAuditEvent(orgId, userId, 'member_left', {
      memberId: membership.id,
    });

    return { success: true, message: 'Successfully left organization' };
  }

  async transferOwnership(
    orgId: string,
    currentOwnerId: string,
    newOwnerMemberId: string,
  ) {
    const currentOwnerMembership = await this.getMembership(
      orgId,
      currentOwnerId,
    );
    if (currentOwnerMembership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only organization owners can transfer ownership',
      );
    }

    const newOwnerMembership = await this.prisma.organizationMember.findFirst({
      where: { id: newOwnerMemberId, organizationId: orgId, isActive: true },
    });

    if (!newOwnerMembership) {
      throw new NotFoundException('New owner membership not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Demote current owner to ADMIN
      await tx.organizationMember.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'ADMIN' },
      });

      // Promote new member to OWNER
      await tx.organizationMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' },
      });

      // Log to audit trail
      await this.logAuditEvent(orgId, currentOwnerId, 'ownership_transferred', {
        fromMemberId: currentOwnerMembership.id,
        toMemberId: newOwnerMembership.id,
      });
    });
  }

  private async verifyAdminAccess(orgId: string, userId: string) {
    const membership = await this.getMembership(orgId, userId);
    if (
      !membership ||
      (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async verifyMembership(orgId: string, userId: string) {
    const membership = await this.getMembership(orgId, userId);
    if (!membership) {
      throw new ForbiddenException('Organization access denied');
    }
  }

  private async getMembership(orgId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
        isActive: true,
      },
    });
  }

  private async logAuditEvent(
    orgId: string,
    userId: string,
    action: string,
    details: any,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: userId,
        action: action,
        resourceType: 'member',
        details: details,
      },
    });
  }
}
