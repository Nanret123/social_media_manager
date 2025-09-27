import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Platform, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RateLimitService } from 'src/rate-limit/rate-limit.service';
import {
  IPlatformClient,
  PostingResult,
  PlatformPost,
} from './interfaces/platform-client.interface';
import { MediaService } from 'src/media/media.service';
import { FacebookClient } from './clients/facebook.client';
import { InstagramClient } from './clients/instagram.client';
import { LinkedInClient } from './clients/linkedin.client';
import { TwitterClient } from './clients/twitter.client';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class SocialPostingService {
  private readonly logger = new Logger(SocialPostingService.name);
  private readonly clients: Map<Platform, IPlatformClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimitService: RateLimitService,
    private readonly instagramClient: InstagramClient,
    private readonly facebookClient: FacebookClient,
    private readonly linkedinClient: LinkedInClient,
    private readonly twitterClient: TwitterClient,
    private readonly mediaService: MediaService,
    //private readonly notificationsService: NotificationService,
  ) {
    this.clients = new Map<Platform, IPlatformClient>([
      [Platform.INSTAGRAM, this.instagramClient],
      [Platform.FACEBOOK, this.facebookClient],
      [Platform.LINKEDIN, this.linkedinClient],
      [Platform.X, this.twitterClient],
    ]);
  }

 async publishPost(
    organizationId: string,
    postData: {
      platform: Platform;
      accountId: string;
      content: string;
      mediaFileIds?: string[];
      options?: Record<string, any>;
    },
  ): Promise<PostingResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify account access
      const socialAccount = await this.verifyAccountAccess(
        organizationId,
        postData.platform,
        postData.accountId,
        tx,
      );

      // 2. Rate limit check
      await this.rateLimitService.checkLimit(
        postData.platform,
        socialAccount.platformAccountId,
        'publish',
      );

      // 3. Validate credentials
      const client = this.getPlatformClient(postData.platform);
      const isValid = await client.validateCredentials(socialAccount.id);
      
      if (!isValid) {
        await this.handleInvalidCredentials(socialAccount.id, tx);
        throw new ForbiddenException('Social account credentials are invalid');
      }

      // 4. Prepare media
      const mediaUrls = await this.prepareMediaUploads(
        postData.platform,
        socialAccount.id,
        organizationId,
        postData.mediaFileIds,
        tx,
      );

      // 5. Format content
      const formattedContent = this.formatContentForPlatform(
        postData.platform,
        postData.content,
      );

      // 6. Publish to platform
      const platformPost: PlatformPost = {
        content: formattedContent,
        mediaUrls,
        options: postData.options,
      };

      const result = await client.publishPost(socialAccount.id, platformPost);

      // 7. Record result
      // await this.recordPublishResult(
      //   organizationId,
      //   socialAccount.id,
      //   result,
      //   tx,
      // );

      return result;
    });
  }

  private async prepareMediaUploads(
    platform: Platform,
    platformAccountId: string,
    organizationId: string,
    mediaFileIds?: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    if (!mediaFileIds?.length) return [];

    // Check media upload rate limits
    await this.rateLimitService.checkLimit(
      platform,
      platformAccountId,
      'media_upload',
    );

    const mediaFiles = await Promise.all(
      mediaFileIds.map((id) =>
        this.mediaService.getFileById(id, organizationId, tx).catch(() => null),
      ),
    );

    const validFiles = mediaFiles.filter(Boolean);
    if (!validFiles.length) {
      throw new NotFoundException('No valid media files found');
    }

    const client = this.getPlatformClient(platform);
    const uploadedMediaIds: string[] = [];

    for (const file of validFiles) {
      try {
        // Download media file
        const buffer = await this.downloadMediaFile(file.url);

        const mediaId = await client.uploadMedia(platformAccountId, {
          buffer,
          filename: file.filename,
          mimeType: file.mimeType,
          altText: file.metadata?.altText,
        });

        uploadedMediaIds.push(mediaId);
        this.logger.log(`Uploaded media to ${platform}: ${file.filename}`);
      } catch (error) {
        this.logger.error(
          `Failed media upload to ${platform} for file ${file.filename}`,
          error,
        );
        throw new BadRequestException(`Media upload failed: ${error.message}`);
      }
    }

    return uploadedMediaIds;
  }

  private async verifyAccountAccess(
    organizationId: string,
    platform: Platform,
    accountId: string,
    tx: Prisma.TransactionClient,
  ) {
    const socialAccount = await tx.socialAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
        platform,
        isActive: true,
        accessToken: { not: null },
      },
    });

    if (!socialAccount) {
      throw new ForbiddenException('Social account not found or access denied');
    }

    return socialAccount;
  }

  private getPlatformClient(platform: Platform): IPlatformClient {
    const client = this.clients.get(platform);
    if (!client) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return client;
  }

  private async downloadMediaFile(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }

  private formatContentForPlatform(
    platform: Platform,
    content: string,
  ): string {
    const platformLimits = {
      [Platform.INSTAGRAM]: 2200,
      [Platform.FACEBOOK]: 63206,
      [Platform.LINKEDIN]: 3000,
      [Platform.X]: 280,
    };

    const limit = platformLimits[platform] || Infinity;
    return content.length > limit ? content.slice(0, limit) : content;
  }

  private async recordSuccessfulPublish(
    organizationId: string,
    accountId: string,
    result: PostingResult,
    tx: Prisma.TransactionClient,
  ) {
    await Promise.all([
      // Update account usage
      tx.socialAccount.update({
        where: { id: accountId },
        data: { lastSyncAt: new Date() },
      }),
      // Record metrics
      tx.publishingMetric.create({
        data: {
          organizationId,
          platform: result.metadata?.platform,
          success: true,
          timestamp: new Date(),
        },
      }),
    ]);
  }

  private async recordFailedPublish(
    organizationId: string,
    platform: Platform,
    error: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.publishingMetric.create({
      data: {
        organizationId,
        platform,
        success: false,
        errorMessage: error,
        timestamp: new Date(),
      },
    });
  }

  private async handleInvalidCredentials(
    accountId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.socialAccount.update({
      where: { id: accountId },
      data: {
        isActive: false,
        errorMessage: 'Invalid credentials',
      },
    });

    // Notify organization about disconnected account
    // await this.notificationsService.notifyAccountDisconnected(accountId);
  }
}
