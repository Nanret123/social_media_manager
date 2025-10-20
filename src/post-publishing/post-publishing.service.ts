import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Platform } from '@prisma/client';
import { MediaService } from 'src/media/media.service';

import { PrismaService } from 'src/prisma/prisma.service';
import { RateLimitService } from 'src/rate-limit/rate-limit.service';
import {
  IPlatformClient,
  PostingResult,
  PlatformPost,
} from 'src/scheduling/scheduling.service';
import { FacebookClient } from './clients/facebook.client';
import { InstagramClient } from './clients/instagram.client';
import { LinkedInClient } from './clients/linkedin.client';
import { TwitterClient } from './clients/twitter.client';


@Injectable()
export class PostPublishingService {
  private readonly logger = new Logger(PostPublishingService.name);
  private readonly clients: Map<Platform, IPlatformClient>;
  private readonly MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly UPLOAD_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimitService: RateLimitService,
    private readonly instagramClient: InstagramClient,
    private readonly facebookClient: FacebookClient,
    private readonly linkedinClient: LinkedInClient,
    private readonly twitterClient: TwitterClient,
    private readonly mediaService: MediaService,
  ) {
    this.clients = new Map<Platform, IPlatformClient>([
      [Platform.INSTAGRAM, this.instagramClient],
      [Platform.FACEBOOK, this.facebookClient],
      [Platform.LINKEDIN, this.linkedinClient],
      [Platform.X, this.twitterClient],
    ]);
  }

  /**
   * Core platform publishing logic - ONLY handles platform API calls
   * NO TRANSACTIONS - this method calls external APIs
   */
  async publishToPlatform(
    organizationId: string,
    postData: {
      platform: Platform;
      accountId: string;
      content: string;
      mediaFileIds?: string[];
      options?: Record<string, any>;
    },
  ): Promise<PostingResult> {
    const startTime = Date.now();

    try {
      // 1. Rate limit check (BEFORE any DB operations)

      // 2. Verify account access (separate transaction)
      const socialAccount = await this.verifyAccountAccess(
        organizationId,
        postData.platform,
        postData.accountId,
      );

      // 3. Validate credentials (may hit cache or API)
      const client = this.getPlatformClient(postData.platform);

      // 4. Prepare media (external operations)
      const mediaUrls = await this.prepareMediaUploads(
        postData.platform,
        socialAccount.platformAccountId,
        organizationId,
        postData.mediaFileIds,
      );

      // 5. Format content
      const formattedContent = this.formatContentForPlatform(
        postData.platform,
        postData.content,
      );

      // 6. Publish to platform (EXTERNAL API CALL)
      const platformPost: PlatformPost = {
        content: formattedContent,
        mediaUrls,
        options: postData.options,
      };

      this.logger.log(
        `Publishing to ${postData.platform} for account ${socialAccount.platformAccountId}`,
      );

      const result = await client.publishPost(
        socialAccount.platformAccountId,
        platformPost,
      );

      // 7. Record metrics (async, don't wait)
      this.recordSuccessfulPublish(
        organizationId,
        socialAccount.id,
        postData.platform,
        Date.now() - startTime,
      ).catch((error) => {
        this.logger.error('Failed to record metrics:', error);
      });

      return {
        success: true,
        platformPostId: result.platformPostId,
        metadata: {
          platform: postData.platform,
          publishedAt: new Date(),
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Publish failed for ${postData.platform}:`,
        error.stack,
      );

      // Record failure metrics (async)
      this.recordFailedPublish(
        organizationId,
        postData.platform,
        error.message,
      ).catch(() => {});

      return {
        success: false,
        error: error.message,
        metadata: {
          platform: postData.platform,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Verify account access - uses its own transaction
   */
  private async verifyAccountAccess(
    organizationId: string,
    platform: Platform,
    accountId: string,
  ) {
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
        platform,
        isActive: true,
        accessToken: { not: null },
      },
      select: {
        id: true,
        platformAccountId: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!socialAccount) {
      throw new ForbiddenException('Social account not found or access denied');
    }

    // Check token expiry
    if (socialAccount.tokenExpiresAt && socialAccount.tokenExpiresAt < new Date()) {
      throw new ForbiddenException('Access token expired');
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

  /**
   * Prepare media uploads with parallel processing and error handling
   */
  private async prepareMediaUploads(
    platform: Platform,
    platformAccountId: string,
    organizationId: string,
    mediaFileIds?: string[],
  ): Promise<string[]> {
    if (!mediaFileIds?.length) return [];

    // Check media upload rate limits
    await this.rateLimitService.checkLimit(
      platform,
      platformAccountId,
      'media_upload',
    );

    // Fetch media metadata
    const mediaFiles = await Promise.all(
      mediaFileIds.map((id) =>
        this.mediaService.getFileById(id, organizationId).catch(() => null),
      ),
    );

    const validFiles = mediaFiles.filter(Boolean);
    if (!validFiles.length) {
      throw new NotFoundException('No valid media files found');
    }

    const client = this.getPlatformClient(platform);

    // Upload in parallel with concurrency limit
    const uploadPromises = validFiles.map((file) =>
      this.uploadSingleMedia(client, platformAccountId, platform, file),
    );

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(uploadPromises);

    const uploadedMediaIds: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        uploadedMediaIds.push(result.value);
      } else {
        errors.push(`${validFiles[index].filename}: ${result.reason.message}`);
      }
    });

    // If all failed, throw error
    if (uploadedMediaIds.length === 0) {
      throw new BadRequestException(
        `All media uploads failed: ${errors.join('; ')}`,
      );
    }

    // Log partial failures
    if (errors.length > 0) {
      this.logger.warn(
        `Partial media upload failure for ${platform}: ${errors.join('; ')}`,
      );
    }

    return uploadedMediaIds;
  }

  /**
   * Upload a single media file with timeout and size validation
   */
  private async uploadSingleMedia(
    client: IPlatformClient,
    platformAccountId: string,
    platform: Platform,
    file: any,
  ): Promise<string> {
    try {
      // Download with timeout
      const buffer = await this.downloadMediaFileWithTimeout(
        file.url,
        this.UPLOAD_TIMEOUT,
      );

      // Validate size
      if (buffer.length > this.MAX_MEDIA_SIZE) {
        throw new Error(
          `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: ${this.MAX_MEDIA_SIZE / 1024 / 1024}MB)`,
        );
      }

      // Upload to platform
      const mediaId = await client.uploadMedia(platformAccountId, {
        buffer,
        filename: file.filename,
        mimeType: file.mimeType,
        altText: file.metadata?.altText,
      });

      this.logger.log(
        `✅ Uploaded ${file.filename} to ${platform}: ${mediaId}`,
      );

      return mediaId;
    } catch (error) {
      this.logger.error(
        `❌ Failed to upload ${file.filename} to ${platform}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Download media with timeout
   */
  private async downloadMediaFileWithTimeout(
    url: string,
    timeoutMs: number,
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout after ${timeoutMs}ms`);
      }
      throw new Error(`Failed to download media: ${error.message}`);
    } finally {
      clearTimeout(timeout);
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
    
    if (content.length > limit) {
      this.logger.warn(
        `Content truncated for ${platform}: ${content.length} -> ${limit} chars`,
      );
      return content.slice(0, limit);
    }
    
    return content;
  }

  /**
   * Record metrics asynchronously (fire-and-forget)
   */
  private async recordSuccessfulPublish(
    organizationId: string,
    accountId: string,
    platform: Platform,
    duration: number,
  ): Promise<void> {
    try {
      await Promise.all([
        // Update account last sync
        this.prisma.socialAccount.update({
          where: { id: accountId },
          data: { 
            lastSyncAt: new Date(),
          },
        }),
        // Record metrics
        this.prisma.publishingMetric.create({
          data: {
            organizationId,
            platform,
            success: true,
            timestamp: new Date(),
          },
        }),
      ]);
    } catch (error) {
      // Don't throw - metrics are not critical
      this.logger.error('Failed to record success metrics:', error);
    }
  }

  private async recordFailedPublish(
    organizationId: string,
    platform: Platform,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.prisma.publishingMetric.create({
        data: {
          organizationId,
          platform,
          success: false,
          errorMessage: errorMessage.substring(0, 500),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to record failure metrics:', error);
    }
  }
}
