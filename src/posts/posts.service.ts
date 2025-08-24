import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PlatformsService } from 'src/platforms/platforms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePost } from './dto/create-post.dto';
import { UpdatePost } from './dto/update-post.dto';
import { SchedulerService } from 'src/scheduler/scheduler.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private platformService: PlatformsService,
    private schedulerService: SchedulerService,
  ) {}

  async createPost(userId: string, createPostDto: CreatePost) {
    const { socialAccountId, content, mediaUrls, scheduledAt } = createPostDto;

    // Verify social account belongs to user
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId,
        isActive: true,
      },
    });

    if (!socialAccount) {
      throw new BadRequestException(
        'Social account not found or not accessible',
      );
    }

    // Create post
    const post = await this.prisma.post.create({
      data: {
        userId,
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
      },
    });

    // If scheduled, add to queue
    if (scheduledAt) {
      await this.schedulerService.schedulePost(post.id, scheduledAt);
    }

    return post;
  }

  async publishPostNow(userId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
      include: { socialAccount: true }, // optional, if you need account info
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Post already published');
    }

    try {
      // Publish post via platform service
      const result = await this.platformService.publishPost(postId);

      // Update post status in DB
      await this.prisma.post.update({
        where: { id: postId },
        data: { status: PostStatus.PUBLISHED, publishedAt: new Date() },
      });

      return result;
    } catch (error) {
      throw new BadRequestException('Failed to publish post');
    }
  }

  async getUserPosts(userId: string, filters?: any) {
    const { status, platform, limit = 20, offset = 0 } = filters || {};

    const where: any = { userId };

    if (status) where.status = status;

    // Proper relation filtering for platform
    if (platform) {
      where.socialAccount = { platform };
      // If Prisma relation uses 'some', adjust to:
      // where.socialAccount = { some: { platform } };
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
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async updatePost(userId: string, postId: string, updatePostDto: UpdatePost) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update published post');
    }

    // If updating scheduled time and post is already scheduled
    if (updatePostDto.scheduledAt && post.status === PostStatus.SCHEDULED) {
      // Cancel existing job and reschedule
      await this.schedulerService.cancelScheduledPost(postId);
      await this.schedulerService.schedulePost(
        postId,
        updatePostDto.scheduledAt,
      );
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        ...updatePostDto,
        status: updatePostDto.scheduledAt
          ? PostStatus.SCHEDULED
          : updatePostDto.status
            ? { set: updatePostDto.status as PostStatus }
            : { set: post.status },
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

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Cancel scheduled job if exists
    if (post.status === PostStatus.SCHEDULED) {
      await this.schedulerService.cancelScheduledPost(postId);
    }

    return this.prisma.post.delete({
      where: { id: postId },
    });
  }
}
