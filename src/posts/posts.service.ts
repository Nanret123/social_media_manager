import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PlatformsService } from 'src/platforms/platforms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePost } from './dto/create-post.dto';
import { UpdatePost } from './dto/update-post.dto';
import { SchedulerService } from 'src/posts/scheduler.service';
import readonly from 'twitter-api-v2/dist/esm/client/readonly';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SchedulerService)) // Avoid circular dependency
    private readonly schedulerService: SchedulerService,
    private readonly platformsService: PlatformsService,
  ) {}

  async createPost(
    authorId: string,
    organizationId: string,
    createPostDto: CreatePost,
  ) {
    const { socialAccountId, content, mediaUrls, scheduledAt } = createPostDto;

    // 1. Verify social account belongs to the USER'S ORGANIZATION
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        organizationId,
        isActive: true,
      },
    });

    if (!socialAccount) {
      throw new BadRequestException(
        'Social account not found or not accessible',
      );
    }

    // 2. Create post - Link it to the ORGANIZATION
    const post = await this.prisma.post.create({
      data: {
        authorId, // The user who created it
        organizationId,
        socialAccountId,
        content,
        mediaUrls: mediaUrls || [],
        scheduledAt,
        status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      },
      include: {
        socialAccount: {
          select: {
            platform: true,
            username: true,
          },
        },
        author: { // Include author info
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // 3. If scheduled, add to queue
    if (scheduledAt) {
      await this.schedulerService.schedulePost(post.id, scheduledAt);
    }

    return post;
  }

  async publishPostNow(userId: string, organizationId: string, postId: string) {
    // First, verify user has access to the post in this org
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        organizationId,
      },
      include: { socialAccount: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Optional: Add an extra check if only authors can publish
    // if (post.authorId !== userId) {
    //   throw new ForbiddenException('You can only publish your own posts');
    // }

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Post already published');
    }

    try {
      // Publish post via platform service
      const result = await this.platformsService.publishPost(postId);

      // Update post status in DB
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          platformPostId: result.id, // Save the ID from the social platform
        },
      });

      return result;
    } catch (error) {
      // Log the actual error for debugging
      console.error(`Publish failed for post ${postId}:`, error);
      // Update the post to failed status
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.FAILED,
          errorMessage: error.message?.substring(0, 500), // Truncate long errors
        },
      });
      throw new BadRequestException(
        `Failed to publish post: ${error.message}`,
      );
    }
  }

  async getOrganizationPosts(organizationId: string, filters?: any) {
    // Renamed from getUserPosts to getOrganizationPosts
    const { status, platform, limit = 20, offset = 0 } = filters || {};

    const where: any = { organizationId }; // <-- Filter by ORGANIZATION

    if (status) where.status = status;
    if (platform) {
      where.socialAccount = { platform };
    }

    return this.prisma.post.findMany({
      where,
      include: {
        socialAccount: {
          select: {
            platform: true,
            username: true,
          },
        },
        author: {
          // Show who created the post
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async updatePost(
    organizationId: string,
    postId: string,
    updatePostDto: UpdatePost,
  ) {
    // First, find the post within the organization
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        organizationId,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Optional: Check if the user is the author or has edit permissions
    // if (post.authorId !== userId) {
    //   throw new ForbiddenException('You can only edit your own posts');
    // }

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update published post');
    }

    // Handle rescheduling logic
    const isRescheduling =
      updatePostDto.scheduledAt &&
      post.status === PostStatus.SCHEDULED &&
      updatePostDto.scheduledAt.getTime() !== post.scheduledAt.getTime();

    if (isRescheduling) {
      await this.schedulerService.cancelScheduledPost(postId, organizationId);
      await this.schedulerService.schedulePost(postId, updatePostDto.scheduledAt);
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        ...updatePostDto,
        // Smart status handling
        status: updatePostDto.scheduledAt
          ? PostStatus.SCHEDULED
          : updatePostDto.status ?? post.status, // Use new status or keep old one
      },
      include: {
        socialAccount: {
          select: {
            platform: true,
            username: true,
          },
        },
      },
    });
  }

  async deletePost(organizationId: string, postId: string) {
    // First, find the post within the organization
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        organizationId, // <-- CRITICAL
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Optional: Check if the user is the author or has delete permissions
    // if (post.authorId !== userId) {
    //   throw new ForbiddenException('You can only delete your own posts');
    // }

    // Cancel scheduled job if exists
    if (post.status === PostStatus.SCHEDULED) {
      await this.schedulerService.cancelScheduledPost(postId, organizationId);
    }

    return this.prisma.post.delete({
      where: { id: postId },
    });
  }
}
