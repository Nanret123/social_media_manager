// src/posts/posts.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostStatus, Platform, Prisma } from '@prisma/client';
import { ApprovalsService } from 'src/approvals/approvals.service';
import { PostingResult } from 'src/scheduling/scheduling.service';
import { CreatePostDto } from './dto/create-post.dto';
import { MediaService } from 'src/media/media.service';
import { PostFilterDto } from './dto/post-filter.dto';
import { PostPublishingService } from '../post-publishing/post-publishing.service';
import { UpdatePostDto } from './dto/update-post.dto';
import { parseISO, isBefore } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

interface PostMetadata {
  options?: Record<string, any>;
  [key: string]: any;
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalsService: ApprovalsService,
    private readonly mediaService: MediaService,
    private readonly postPublishingService: PostPublishingService,
  ) {}

  /**
   * Create a new post
   */
  async createPost(organizationId: string, userId: string, dto: CreatePostDto) {

    return this.prisma.$transaction(async (tx) => {
      // 1. Validate inputs and access
      await this.validatePostCreation(organizationId, userId, dto, tx);

      const mediaFileIds = dto.mediaFileIds || [];

      // 2. Always create as DRAFT initially
      const post = await tx.post.create({
        data: {
          organizationId,
          authorId: userId,
          socialAccountId: dto.socialAccountId,
          content: dto.content,
          mediaFileIds,
          status: PostStatus.DRAFT,
          timezone: dto.timezone,
          scheduledAt: dto.scheduledAt,
          metadata: {
            platform: dto.platform,
            contentType: dto.contentType,
            mediaFileIds,
            ...dto.metadata,
          } as Prisma.JsonValue,
        },
        include: this.getPostIncludes(),
      });

      this.logger.log(`💾 Post ${post.id} created as draft`);

      return post;
    });
  }
  /**
   * Submit a draft post for approval workflow
   */
  async submitForApproval(
    postId: string,
    organizationId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate post
      const post = await tx.post.findFirst({
        where: {
          id: postId,
          organizationId,
          status: PostStatus.DRAFT,
        },
      });

      if (!post) {
        throw new NotFoundException(
          'Draft post not found or already submitted',
        );
      }

      // 2. Create approval request record
      await this.approvalsService.createApprovalRequest(postId, userId, tx);

      // 3. Update post status to PENDING_APPROVAL
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { status: PostStatus.PENDING_APPROVAL },
      });

      // 4. Optionally notify approvers
      // await this.notificationsService.notifyApprovers(organizationId, postId);

      this.logger.log(`📋 Draft post ${postId} submitted for approval`);

      return updatedPost;
    });
  }

  /**
   * Get organization posts with filters and pagination
   */
  async getOrganizationPosts(organizationId: string, filters: PostFilterDto) {
    const where = this.buildPostWhereClause(organizationId, filters);

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: this.getPostIncludes(),
        orderBy: { createdAt: 'desc' },
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

  /**
   * Delete a post (only drafts and failed posts)
   */
  async deletePost(postId: string, organizationId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
      select: { status: true, jobId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (
      !(
        [
          PostStatus.DRAFT,
          PostStatus.FAILED,
          PostStatus.CANCELED,
        ] as readonly PostStatus[]
      ).includes(post.status)
    ) {
      throw new BadRequestException(
        `Cannot delete post with status ${post.status}`,
      );
    }

    // Note: Job cancellation would now be handled by ApprovalsService
    // if it scheduled the post

    await this.prisma.post.delete({ where: { id: postId } });
    this.logger.log(`🗑️ Deleted post ${postId}`);
  }

  /** Get a single post by ID with details */
  async getPostById(postId: string, organizationId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
      include: this.getPostIncludes(),
    });

    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  /**
   * Update a post (only drafts or failed posts)
   */
  async updatePost(postId: string, organizationId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
    });

    if (!post) throw new NotFoundException('Post not found');

    const EDITABLE_STATUSES: PostStatus[] = [
      PostStatus.DRAFT,
      PostStatus.FAILED,
      PostStatus.PENDING_APPROVAL,
    ];

    if (!EDITABLE_STATUSES.includes(post.status)) {
      throw new BadRequestException(
        `Cannot update post with status ${post.status}`,
      );
    }

    if (dto.scheduledAt && new Date(dto.scheduledAt) <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    if (dto.mediaFileIds?.length) {
      await this.validateMediaFiles(dto.mediaFileIds, organizationId);
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content ?? post.content,
        mediaFileIds: dto.mediaFileIds ?? post.mediaFileIds,
        scheduledAt: dto.scheduledAt ?? post.scheduledAt,
        updatedAt: new Date(),
      },
      include: this.getPostIncludes(),
    });

    this.logger.log(`📝 Post ${postId} updated successfully`);
    return updated;
  }

  // ========== ORCHESTRATION METHODS ==========

  /**
   * Main publish execution orchestrator
   */
  async executePublish(
    organizationId: string,
    postId: string,
  ): Promise<PostingResult> {
    const post = await this.getPostWithAccount(organizationId, postId);

    try {
      // Update status to publishing
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHING,
          queueStatus: 'PROCESSING',
        },
      });

      // Call platform publishing service
      const result = await this.postPublishingService.publishToPlatform(
        post.organizationId,
        {
          platform: post.socialAccount.platform as Platform,
          accountId: post.socialAccount.id,
          content: post.content,
          mediaFileIds: post.mediaFileIds,
          options: (post.metadata as PostMetadata)?.options,
        },
      );

      // Handle result
      if (result.success) {
        await this.markPostAsPublished(postId, result.platformPostId);
        return result;
      } else {
        await this.markPostAsFailed(postId, result.error);
        return result;
      }
    } catch (error) {
      this.logger.error(`Publish failed for post ${postId}:`, error.stack);
      await this.markPostAsFailed(postId, error.message);
      throw error;
    }
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Validate post creation inputs
   */
  private async validatePostCreation(
    organizationId: string,
    userId: string,
    dto: CreatePostDto,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    console.log(
      `Validating post creation for org ${organizationId}, user ${userId}`,
    );
    // Verify social account
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

    const platformMismatch =
      socialAccount.platform === 'META'
        ? !['FACEBOOK', 'INSTAGRAM'].includes(dto.platform)
        : dto.platform !== socialAccount.platform;

    if (platformMismatch) {
      throw new BadRequestException(
        `Platform mismatch: expected ${socialAccount.platform}, got ${dto.platform}`,
      );
    }

    /**
   * ✅ Validate scheduled time (must be future)
   * dto.scheduledAt is a string like "2025-10-19T16:50:00"
   * dto.timezone is e.g. "Africa/Lagos"
   */
  const localDate = parseISO(dto.scheduledAt); // convert string to Date (interpreted as local)
  const now = new Date();

  // Convert the "local" time to actual UTC timestamp for comparison
  const utcDate = fromZonedTime(localDate, dto.timezone);

  if (isBefore(utcDate, now)) {
    throw new BadRequestException('Scheduled time must be in the future.');
  }

    // Validate media files
    if (dto.mediaFileIds?.length > 0) {
      await this.validateMediaFiles(dto.mediaFileIds, organizationId);
    }
  }

  /**
   * Validate media files belong to organization
   */
  private async validateMediaFiles(
    mediaFileIds: string[],
    organizationId: string,
  ): Promise<void> {
    const validationResults = await Promise.all(
      mediaFileIds.map(async (fileId) => {
        try {
          const file = await this.mediaService.getFileById(
            fileId,
            organizationId,
          );
          return !!file;
        } catch {
          return false;
        }
      }),
    );

    const allValid = validationResults.every((valid) => valid);
    if (!allValid) {
      throw new ForbiddenException(
        'One or more media files not found or access denied',
      );
    }
  }

  /**
   * Mark post as successfully published
   */
  private async markPostAsPublished(
    postId: string,
    platformPostId?: string,
  ): Promise<void> {
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        queueStatus: 'COMPLETED',
        errorMessage: null,
        retryCount: 0,
        jobId: null,
      },
    });

    this.logger.log(`✅ Post ${postId} published successfully`);
  }

  /**
   * Mark post as failed with retry logic
   */
  private async markPostAsFailed(
    postId: string,
    errorMessage?: string,
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { retryCount: true, maxRetries: true, status: true },
    });

    if (!post) {
      this.logger.warn(`Post ${postId} not found when marking as failed`);
      return;
    }

    const maxRetries = post.maxRetries || this.MAX_RETRIES;
    const newRetryCount = (post.retryCount || 0) + 1;
    const shouldRetry = newRetryCount < maxRetries;

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: shouldRetry ? PostStatus.FAILED : PostStatus.FAILED,
        queueStatus: shouldRetry ? 'RETRYING' : 'FAILED',
        errorMessage: errorMessage?.substring(0, 1000),
        retryCount: newRetryCount,
      },
    });

    const status = shouldRetry ? 'RETRYING' : 'FAILED';
    this.logger.warn(
      `❌ Post ${postId} marked as ${status} (attempt ${newRetryCount}/${maxRetries}): ${errorMessage}`,
    );
  }

  /**
   * Get post with social account details
   */
  private async getPostWithAccount(organizationId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, organizationId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            platformAccountId: true,
            isActive: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }

    if (!post.socialAccount) {
      throw new BadRequestException(
        `Post ${postId} has no associated social account`,
      );
    }

    if (!post.socialAccount.isActive) {
      throw new BadRequestException(
        `Social account for post ${postId} is inactive`,
      );
    }

    return post;
  }

  /**
   * Build WHERE clause for post filtering
   */
  private buildPostWhereClause(
    organizationId: string,
    filters: PostFilterDto,
  ): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = { organizationId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.platform) {
      where.socialAccount = { platform: filters.platform };
    }

    if (filters.startDate || filters.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) {
        where.scheduledAt.gte = filters.startDate.toISOString();
      }
      if (filters.endDate) {
        where.scheduledAt.lte = filters.endDate.toISOString();
      }
    }

    if (filters.authorId) {
      where.authorId = filters.authorId;
    }

    return where;
  }
  /**
   * Standard post includes for queries
   */
  private getPostIncludes() {
    return {
      socialAccount: {
        select: {
          id: true,
          platform: true,
          username: true,
          isActive: true,
        },
      },
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
      approvals: {
        include: {
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    };
  }
}
