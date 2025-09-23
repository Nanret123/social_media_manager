import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InviteMemberDto } from './dtos/invite-member.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async inviteMember(orgId: string, inviterId: string, dto: InviteMemberDto) {
    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          where: { organizationId: orgId, isActive: true },
        },
      },
    });

    if (existingUser?.memberships.length > 0) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    // Check member limit
    const canInvite = await this.checkMemberLimit(orgId);
    if (!canInvite) {
      throw new BadRequestException('Organization member limit reached');
    }

    // Check for existing pending invitation
    const existingInvitation =
      await this.prisma.organizationInvitation.findFirst({
        where: {
          email: dto.email,
          organizationId: orgId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      });

    if (existingInvitation) {
      throw new ConflictException(
        'Pending invitation already exists for this email',
      );
    }

    // Create invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        email: dto.email,
        organizationId: orgId,
        invitedBy: inviterId,
        role: dto.role,
        message: dto.message,
        permissions: dto.permissions,
        token,
        expiresAt,
      },
      include: {
        organization: true,
        inviter: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    // Send invitation email
    await this.mailService.sendInvitationEmail({
      to: dto.email,
      organizationName: invitation.organization.name,
      inviterName:
        `${invitation.inviter?.firstName ?? ''} ${invitation.inviter?.lastName ?? ''}`.trim(),
      token,
      role: dto.role,
      message: dto.message,
    });

    // Log to audit trail
    await this.logAuditEvent(orgId, inviterId, 'member_invited', {
      email: dto.email,
      role: dto.role,
    });

    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been processed');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user email matches invitation email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.email !== invitation.email) {
      throw new BadRequestException(
        'Invitation email does not match user email',
      );
    }

    // Check member limit
    const canJoin = await this.checkMemberLimit(invitation.organizationId);
    if (!canJoin) {
      throw new BadRequestException('Organization member limit reached');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create organization membership
      const membership = await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: userId,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
          permissions: invitation.permissions,
        },
      });

      // Update invitation status
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // Log to audit trail
      await this.logAuditEvent(
        invitation.organizationId,
        userId,
        'member_joined',
        {
          invitationId: invitation.id,
          role: invitation.role,
        },
      );

      return membership;
    });
  }

  async resendInvitation(invitationId: string, inviterId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: { organization: true, inviter: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Cannot resend a processed invitation');
    }

    // Generate new token and extend expiration
    const newToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedInvitation = await this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        resentAt: new Date(),
      },
    });

    // Resend email
    await this.mailService.sendInvitationEmail({
      to: invitation.email,
      organizationName: invitation.organization.name,
      inviterName:
        `${invitation.inviter?.firstName ?? ''} ${invitation.inviter?.lastName ?? ''}`.trim(),
      token: newToken,
      role: invitation.role,
      message: invitation.message,
    });

    return updatedInvitation;
  }

  async revokeInvitation(invitationId: string, revokerId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const updatedInvitation = await this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    // Log to audit trail
    await this.logAuditEvent(
      invitation.organizationId,
      revokerId,
      'invitation_revoked',
      {
        invitationId: invitation.id,
        email: invitation.email,
      },
    );

    return updatedInvitation;
  }

  async getOrganizationInvitations(orgId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId: orgId },
      include: {
        inviter: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async checkMemberLimit(orgId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxMembers: true },
    });

    const memberCount = await this.prisma.organizationMember.count({
      where: { organizationId: orgId, isActive: true },
    });

    return memberCount < organization.maxMembers;
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
        resourceType: 'organization',
        details: details,
      },
    });
  }
}
