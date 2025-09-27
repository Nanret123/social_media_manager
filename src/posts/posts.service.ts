// src/posts/posts.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  PostStatus,
  Platform,
  Prisma,
} from '@prisma/client';
import { ApprovalsService } from 'src/approvals/approvals.service';
import { PostMetadata, SchedulingService } from 'src/scheduling/scheduling.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { MediaService } from 'src/media/media.service';
import { PostFilterDto } from './dto/post-filter.dto';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: SchedulingService,
    private readonly approvalsService: ApprovalsService,
    //private readonly billingService: BillingService,
    private readonly mediaService: MediaService,
  ) {}

  async createPost(organizationId: string, userId: string, dto: CreatePostDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate inputs and access
      await this.validatePostCreation(organizationId, userId, dto, tx);

      // 2. Check billing credits
      // await this.billingService.recordUsage(organizationId, {
      //   metric: 'post_creation',
      //   quantity: 1,
      // });

      // 3. Determine initial status
      const status = this.determineInitialStatus(dto);

      // 4. Create post
      const post = await tx.post.create({
        data: {
          organizationId: organizationId, // Use parameter, not from DTO
          authorId: userId, // Use parameter, not from DTO
          socialAccountId: dto.socialAccountId,
          content: dto.content,
          mediaFileIds: await this.getMediaUrls(
            dto.mediaFileIds,
            organizationId,
          ),
          requesterId: userId,
          status: status,
          scheduledAt: dto.scheduledAt, // Handle scheduling logic consistently
          metadata: {
            platform: dto.platform,
            contentType: dto.contentType,
            mediaFileIds: dto.mediaFileIds || [],
            ...dto.metadata,
          },
        },
        include: this.getPostIncludes(),
      });

      // 5. Handle approval workflow if needed
      if (status === PostStatus.PENDING_APPROVAL) {
        await this.approvalsService.requestApproval(
          post.id,
          userId,
          organizationId,
        );
      }

      // 6. Schedule immediately if scheduledAt is provided and no approval needed
      if (dto.scheduledAt && status !== PostStatus.PENDING_APPROVAL) {
        await this.scheduleExistingPost(post, dto.scheduledAt, tx);
      }

      return post;
    });
  }

  async schedulePost(
    postId: string,
    organizationId: string,
    dto: SchedulePostDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const post = await this.getPostForScheduling(postId, organizationId, tx);

      this.validatePostForScheduling(post);

      // Use the scheduling service (single source of truth)
      const job = await this.schedulingService.schedulePost({
        postId: post.id,
        organizationId,
        platform: post.socialAccount.platform as Platform,
        accountId: post.socialAccount.id, // Use socialAccount ID, not platformAccountId
        content: post.content,
        mediaFileIds: post.mediaFileIds,
        scheduledAt: dto.scheduledAt,
        options:(post.metadata as PostMetadata)?.options,
      });

      // Update post status
      return tx.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.SCHEDULED,
          scheduledAt: dto.scheduledAt,
          jobId: job.id.toString(),
        },
        include: this.getPostIncludes(),
      });
    });
  }

  async publishNow(postId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: {
          id: postId,
          organizationId,
          status: {
            in: [PostStatus.DRAFT, PostStatus.APPROVED, PostStatus.SCHEDULED],
          },
        },
        include: { socialAccount: true },
      });

      if (!post) {
        throw new NotFoundException('Post not found or cannot be published');
      }

      // Cancel any existing scheduled job
      if (post.jobId) {
        await this.schedulingService.cancelScheduledPost(post.jobId);
      }

      // Publish immediately through scheduling service
      const result = await this.schedulingService.publishImmediately({
        postId: post.id,
        organizationId,
        platform: post.socialAccount.platform as Platform,
        accountId: post.socialAccount.id,
        content: post.content,
        mediaFileIds: post.mediaFileIds,
        options: (post.metadata as PostMetadata)?.options,
      });

      // Update media expiration
      await this.updateMediaExpiration(post, tx);

      // Update post status
      return tx.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
          jobId: null, // Clear job ID since it's published
        },
        include: this.getPostIncludes(),
      });
    });
  }

  async getOrganizationPosts(
    organizationId: string,
    filters: PostFilterDto, // Use DTO for validation
  ) {
    const where = this.buildPostWhereClause(organizationId, filters);
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: this.getPostIncludes(),
        orderBy: { scheduledAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      posts,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async cancelScheduledPost(postId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: {
          id: postId,
          organizationId,
          status: PostStatus.SCHEDULED,
        },
      });

      if (!post) {
        throw new NotFoundException('Scheduled post not found');
      }

      // Cancel the scheduled job
      if (post.jobId) {
        await this.schedulingService.cancelScheduledPost(post.jobId);
      }

      // Update post status
      return tx.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.CANCELED,
          jobId: null,
        },
        include: this.getPostIncludes(),
      });
    });
  }

  // ========== PRIVATE HELPER METHODS ==========

  private async validatePostCreation(
    organizationId: string,
    userId: string,
    dto: CreatePostDto,
    tx: Prisma.TransactionClient,
  ) {
    // Verify social account belongs to organization
    const socialAccount = await tx.socialAccount.findFirst({
      where: {
        id: dto.socialAccountId,
        organizationId,
        isActive: true,
      },
    });

    if (!socialAccount) {
      throw new ForbiddenException('Social account not found or inactive');
    }

    // Validate media files belong to organization
    if (dto.mediaFileIds?.length > 0) {
      await this.validateMediaFiles(dto.mediaFileIds, organizationId, tx);
    }
  }

  private determineInitialStatus(dto: CreatePostDto): PostStatus {
    if (dto.requiresApproval) {
      return PostStatus.PENDING_APPROVAL;
    }
    if (dto.scheduledAt && dto.scheduledAt > new Date()) {
      return PostStatus.SCHEDULED;
    }
    if (dto.publishImmediately) {
      return PostStatus.PUBLISHED; // Will be published immediately
    }
    return PostStatus.DRAFT;
  }

  private async getMediaUrls(
    mediaFileIds: string[],
    organizationId: string,
  ): Promise<string[]> {
    if (!mediaFileIds?.length) return [];

    const files = await Promise.all(
      mediaFileIds.map((id) =>
        this.mediaService.getFileById(id, organizationId).catch(() => null),
      ),
    );

    return files.filter(Boolean).map((file) => file.url);
  }

  private async validateMediaFiles(
    mediaFileIds: string[],
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    for (const fileId of mediaFileIds) {
      const file = await this.mediaService.getFileById(fileId, organizationId);
      if (!file) {
        throw new ForbiddenException(
          `Media file ${fileId} not found or access denied`,
        );
      }
    }
  }

  private async getPostForScheduling(
    postId: string,
    organizationId: string,
    tx: Prisma.TransactionClient,
  ) {
    const post = await tx.post.findFirst({
      where: { id: postId, organizationId },
      include: {
        socialAccount: true,
        approvals: { where: { status: 'PENDING' } },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private validatePostForScheduling(post: any) {
    if (post.status === PostStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Post requires approval before scheduling');
    }

    if (![PostStatus.DRAFT, PostStatus.APPROVED].includes(post.status)) {
      throw new ForbiddenException(
        `Cannot schedule post with status: ${post.status}`,
      );
    }

    if (post.approvals?.length > 0) {
      throw new ForbiddenException('Post has pending approvals');
    }
  }

  private async scheduleExistingPost(
    post: any,
    scheduledAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const job = await this.schedulingService.schedulePost({
      postId: post.id,
      organizationId: post.organizationId,
      platform: post.socialAccount.platform as Platform,
      accountId: post.socialAccount.id,
      content: post.content,
      mediaFileIds: post.mediaUrls,
      scheduledAt: scheduledAt,
      options: post.metadata?.options,
    });

    await tx.post.update({
      where: { id: post.id },
      data: {
        status: PostStatus.SCHEDULED,
        jobId: job.id.toString(),
      },
    });
  }

  private async updateMediaExpiration(post: any, tx: Prisma.TransactionClient) {
    const mediaFileIds = post.metadata?.['mediaFileIds'] as string[];
    if (mediaFileIds?.length > 0) {
      await tx.mediaFile.updateMany({
        where: { id: { in: mediaFileIds } },
        data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
    }
  }

  private buildPostWhereClause(organizationId: string, filters: PostFilterDto) {
    const where: any = { organizationId };

    if (filters.status) where.status = filters.status;
    if (filters.platform) {
      where.socialAccount = { platform: filters.platform };
    }
    if (filters.startDate || filters.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) where.scheduledAt.gte = filters.startDate;
      if (filters.endDate) where.scheduledAt.lte = filters.endDate;
    }
    if (filters.authorId) where.authorId = filters.authorId;

    return where;
  }

  private getPostIncludes() {
    return {
      socialAccount: true,
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
      approvals: {
        include: {
          approver: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      aiContent: { select: { id: true, prompt: true } },
    };
  }
}
