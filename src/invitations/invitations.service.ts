// invitation.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OrganizationRole, InvitationStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { InviteUser } from './dtos/invite-user.dto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async inviteUser(orgId: string, inviterId: string, inviteDto: InviteUser) {
    const { email, role = OrganizationRole.MEMBER } = inviteDto;

    try {
      // 1. Check if user is already a member of the org
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          organizations: {
            where: { organizationId: orgId },
            select: { id: true },
          },
        },
      });

      if (existingUser?.organizations.length > 0) {
        throw new BadRequestException(
          'This user is already a member of the organization',
        );
      }

      // 2. Check for existing PENDING invitation
      const existingPending =
        await this.prisma.organizationInvitation.findFirst({
          where: {
            email,
            organizationId: orgId,
            status: InvitationStatus.PENDING,
          },
        });

      if (existingPending) {
        throw new BadRequestException(
          'A pending invitation already exists for this user',
        );
      }

      // 3. Create new invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const invitation = await this.prisma.organizationInvitation.create({
        data: {
          email,
          organizationId: orgId,
          role,
          token: crypto.randomBytes(32).toString('hex'),
          expiresAt,
          invitedBy: inviterId,
          status: InvitationStatus.PENDING,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // 4. Send invitation email (fire and forget)
      this.sendInvitationEmailAsync(invitation).catch((error) => {
        this.logger.error(
          `Failed to send invitation email to ${email}: ${error.message}`,
        );
      });

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create invitation');
    }
  }

  private async sendInvitationEmailAsync(invitation: any) {
    try {
      await this.mailService.sendInvitationEmail({
        to: invitation.email,
        organizationName: invitation.organization.name,
        inviterName: invitation.inviter.firstName
          ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
          : invitation.inviter.email,
        role: invitation.role,
        token: invitation.token,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email for invitation ${invitation.id}: ${error.message}`,
      );
      // Don't rethrow - email failure shouldn't fail the entire request
    }
  }

  async acceptInvitation(token: string, userId: string) {
    try {
      const invitation = await this.prisma.organizationInvitation.findUnique({
        where: { token },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              isActive: true,
              slug: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invalid or expired invitation');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('This invitation is no longer valid');
      }

      if (invitation.expiresAt < new Date()) {
        await this.prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new BadRequestException('This invitation has expired');
      }

      if (!invitation.organization.isActive) {
        throw new BadRequestException('The organization is no longer active');
      }

      // Verify user's email matches invitation
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (user?.email !== invitation.email) {
        throw new BadRequestException(
          'This invitation was sent to a different email address',
        );
      }

      // Check for existing membership
      const existingMembership =
        await this.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId,
            },
          },
        });

      if (existingMembership) {
        await this.prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED },
        });
        throw new BadRequestException(
          'You are already a member of this organization',
        );
      }

      // Create membership and update invitation in a transaction
      await this.prisma.$transaction([
        this.prisma.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
          },
        }),
        this.prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED },
        }),
      ]);

      return {
        message: 'Invitation accepted successfully',
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        },
        role: invitation.role,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to accept invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to accept invitation');
    }
  }

  async declineInvitation(token: string) {
    try {
      const invitation = await this.prisma.organizationInvitation.findUnique({
        where: { token },
      });

      if (!invitation) {
        throw new NotFoundException('Invalid or expired invitation');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('This invitation is no longer valid');
      }

      await this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.DECLINED },
      });

      return { message: 'Invitation declined successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to decline invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to decline invitation');
    }
  }

  async getPendingInvitations(orgId: string) {
    try {
      const invitations = await this.prisma.organizationInvitation.findMany({
        where: {
          organizationId: orgId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviter: invitation.inviter,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch pending invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch invitations');
    }
  }

  async getMyInvitations(userEmail: string) {
    try {
      const invitations = await this.prisma.organizationInvitation.findMany({
        where: {
          email: userEmail,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invitations.map((invitation) => ({
        id: invitation.id,
        token: invitation.token,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        organization: invitation.organization,
        inviter: invitation.inviter,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch user invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch invitations');
    }
  }

  async cancelInvitation(invitationId: string) {
    try {
      const invitation = await this.prisma.organizationInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('Can only cancel pending invitations');
      }

      await this.prisma.organizationInvitation.delete({
        where: { id: invitationId },
      });

      return { message: 'Invitation cancelled successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to cancel invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to cancel invitation');
    }
  }

  async resendInvitation(invitationId: string, userId: string) {
    try {
      const invitation = await this.prisma.organizationInvitation.findUnique({
        where: { id: invitationId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (!invitation.organization.isActive) {
        throw new BadRequestException(
          'Cannot resend invitation for an inactive organization',
        );
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('Can only resend pending invitations');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const updatedInvitation = await this.prisma.organizationInvitation.update(
        {
          where: { id: invitationId },
          data: {
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt,
            invitedBy: userId,
          },
        },
      );

      // Resend invitation email (async)
      this.sendInvitationEmailAsync({
        ...invitation,
        token: updatedInvitation.token,
        expiresAt: updatedInvitation.expiresAt,
      }).catch((error) => {
        this.logger.error(
          `Failed to resend invitation email: ${error.message}`,
        );
      });

      return { message: 'Invitation resent successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to resend invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to resend invitation');
    }
  }
}
