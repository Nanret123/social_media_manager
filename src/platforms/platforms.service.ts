import { BadRequestException, Injectable } from '@nestjs/common';
import { PostStatus, Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { LinkedInService } from './linkedin/linkedin.service';
import { TwitterService } from './twitter/twitter.service';
import { FileUploadService } from 'src/media/media.service';

@Injectable()
export class PlatformsService {
  constructor(
    private prisma: PrismaService,
    private twitterService: TwitterService,
    private linkedinService: LinkedInService,
  ) {}

 async publishPost(postId: string, cloudinaryService?: FileUploadService): Promise<any> {
  const post = await this.prisma.post.findUnique({
    where: { id: postId },
    include: { socialAccount: true, user: true },
  });

  if (!post) throw new BadRequestException('Post not found');
  if (post.status === PostStatus.PUBLISHED) throw new BadRequestException('Post already published');

  try {
    let result;

    switch (post.socialAccount.platform) {
      case Platform.TWITTER:
        result = await this.twitterService.publishTweet(post, cloudinaryService); // handle media + text
        break;

      case Platform.LINKEDIN:
        result = await this.linkedinService.publishPost(post); // LinkedIn post
        break;

      default:
        throw new BadRequestException(`Platform ${post.socialAccount.platform} not supported yet`);
    }

    // ✅ Update DB on success
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        platformPostId: result.id || result.data?.id,
        errorMessage: null,
        retryCount: 0,
      },
    });

    return result;
  } catch (error) {
    // ⚠️ Update DB on failure
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        errorMessage: error.message,
        retryCount: { increment: 1 },
      },
    });

    throw error;
  }
}

  async getUserSocialAccounts(userId: string) {
    return this.prisma.socialAccount.findMany({
      where: { 
        userId,
        isActive: true 
      },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        profileImage: true,
        createdAt: true,
        lastSyncAt: true,
      },
    });
  }
}
