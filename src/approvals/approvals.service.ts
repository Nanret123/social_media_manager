import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalStatus, PostStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationService,
  ) {}

  async requestApproval(
    postId: string,
    requesterId: string,
    organizationId: string,
  ) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== 'DRAFT') {
      throw new ForbiddenException('Only draft posts can be sent for approval');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create approval request
      const approval = await tx.postApproval.create({
        data: {
          postId,
          requesterId,
          status: 'PENDING',
        },
      });

      // Update post status
      await tx.post.update({
        where: { id: postId },
        data: { status: 'PENDING_APPROVAL' },
      });

      // Notify approvers
      //await this.notificationsService.notifyApprovers(organizationId, postId);

      return approval;
    });
  }

  async approvePost(postId: string, approverId: string, comments?: string) {
    return this.updateApprovalStatus(postId, approverId, 'APPROVED', comments);
  }

  async rejectPost(
    postId: string,
    approverId: string,
    comments: string,
    revisionNotes?: string,
  ) {
    return this.updateApprovalStatus(
      postId,
      approverId,
      'REJECTED',
      comments,
      revisionNotes,
    );
  }

  async requestChanges(
    postId: string,
    approverId: string,
    comments: string,
    revisionNotes: string,
  ) {
    return this.updateApprovalStatus(
      postId,
      approverId,
      'CHANGES_REQUESTED',
      comments,
      revisionNotes,
    );
  }

  private async updateApprovalStatus(
    postId: string,
    approverId: string,
    status: ApprovalStatus,
    comments?: string,
    revisionNotes?: string,
  ) {
    const approval = await this.prisma.postApproval.findUnique({
      where: { postId },
      include: { post: true, requester: true },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    if (approval.status !== 'PENDING') {
      throw new ForbiddenException(
        'Approval request has already been processed',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update approval
      const updatedApproval = await tx.postApproval.update({
        where: { postId },
        data: {
          approverId,
          status,
          comments,
          revisionNotes,
          reviewedAt: new Date(),
        },
      });

      // Update post status
      let postStatus: PostStatus;
      switch (status) {
        case 'APPROVED':
          postStatus = 'APPROVED';
          break;
        case 'REJECTED':
          postStatus = 'DRAFT';
          break;
        case 'CHANGES_REQUESTED':
          postStatus = 'DRAFT';
          break;
      }

      await tx.post.update({
        where: { id: postId },
        data: { status: postStatus },
      });

      // Notify requester
      // await this.notificationsService.notifyApprovalDecision(
      //   approval.requesterId,
      //   postId,
      //   status,
      //   comments,
      // );

      return updatedApproval;
    });
  }

  async getPendingApprovals(organizationId: string, approverId?: string) {
    const where: any = {
      status: 'PENDING',
      post: { organizationId },
    };

    if (approverId) {
      // In a real implementation, you might filter by approver's role/team
      where.post = { ...where.post, authorId: approverId };
    }

    return this.prisma.postApproval.findMany({
      where,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            socialAccount: true,
          },
        },
        requester: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }
}
