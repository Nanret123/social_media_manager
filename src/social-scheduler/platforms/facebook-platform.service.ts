import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import {
  ScheduledPost,
  PublishingResult,
} from '../interfaces/social-scheduler.interface';
import { BasePlatformService } from './base-platform.service';
import { addMinutes } from 'date-fns';

@Injectable()
export class FacebookPlatformService extends BasePlatformService {
  readonly platform = Platform.FACEBOOK;
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';
  private readonly maxContentLength = 63206;
  private readonly concurrencyLimit = 3;
  private readonly uploadTimeout = 60000;
  private readonly requestTimeout = 30000;
  protected readonly logger = new Logger(FacebookPlatformService.name);

  constructor(http: HttpService) {
    super(http);
  }

  /** Schedule a Facebook post */
  async schedulePost(post: ScheduledPost): Promise<PublishingResult> {
    return this.makeApiRequest(async () => {
      const { accessToken, pageId } = post.metadata;
      this.validateFacebookPost(post, true);

      const mediaAttachments = await this.handleMediaUpload(
        pageId,
        post.mediaUrls,
        accessToken,
      );

      const params = this.buildScheduleParams(
        post,
        accessToken,
        mediaAttachments,
      );

      const url = `${this.baseUrl}/${pageId}/feed`;
      const response = await firstValueFrom(
        this.http.post(url, null, { params, timeout: this.requestTimeout }),
      );

      return {
        success: true,
        platformPostId: response.data.id,
        publishedAt: post.scheduledAt,
        metadata: response.data,
      };
    }, 'schedule Facebook post');
  }

  /** Publish immediately to Facebook */
  async publishImmediately(post: ScheduledPost): Promise<PublishingResult> {
    return this.makeApiRequest(async () => {
      const { accessToken, pageId } = post.metadata;
      this.validateFacebookPost(post, !!pageId);
      console.log(`Publishing Facebook post immediately:`, post);
      const url = pageId
        ? `${this.baseUrl}/${pageId}/feed`
        : `${this.baseUrl}/me/feed`;

      const mediaAttachments = await this.handleMediaUpload(
        pageId,
        post.mediaUrls,
        accessToken,
      );

      const params = this.buildPublishParams(
        post,
        accessToken,
        mediaAttachments,
      );

      console.log(`About to publish Facebook post with params:`, params);
      const response = await firstValueFrom(
        this.http.post(url, null, { params, timeout: this.requestTimeout }),
      );

      return {
        success: true,
        platformPostId: response.data.id,
        publishedAt: new Date(),
        metadata: response.data,
      };
    }, 'publish immediately to Facebook');
  }

  /** Delete a scheduled Facebook post */
  async deleteScheduledPost(
    postId: string,
    accessToken: string,
  ): Promise<boolean> {
    return this.makeApiRequest(async () => {
      if (!postId?.trim()) {
        throw new Error('Post ID is required');
      }
      if (!accessToken?.trim()) {
        throw new Error('Access token is required');
      }

      const url = `${this.baseUrl}/${postId}`;
      await firstValueFrom(
        this.http.delete(url, {
          params: { access_token: accessToken },
          timeout: this.requestTimeout,
        }),
      );
      return true;
    }, 'delete Facebook scheduled post');
  }

  /** Validate that the provided token and page are correct */
  async validateCredentials(accessToken: string): Promise<boolean> {
    try {
      if (!accessToken?.trim()) {
        return false;
      }

      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/me`, {
          params: { access_token: accessToken, fields: 'id,name' },
          timeout: this.requestTimeout,
        }),
      );
      return !!response.data?.id;
    } catch (error) {
      this.logger.warn('Facebook credential validation failed:', error.message);
      return false;
    }
  }

  /** Handle media upload with proper validation */
  private async handleMediaUpload(
    pageId: string,
    mediaUrls: string[] | undefined,
    accessToken: string,
  ): Promise<string[]> {
    if (!mediaUrls?.length) {
      return [];
    }

    return this.uploadMediaToFacebook(pageId, mediaUrls, accessToken);
  }

  /** Upload images, videos, or reels to Facebook */
  private async uploadMediaToFacebook(
    pageId: string,
    mediaUrls: string[],
    accessToken: string,
  ): Promise<string[]> {
    console.log(`Uploading media to Facebook for page ${pageId}:`, mediaUrls);
    const uploadedFbIds: string[] = [];
    const batches = this.createBatches(mediaUrls, this.concurrencyLimit);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((url) =>
          this.uploadSingleMediaFile(pageId, url, accessToken),
        ),
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          uploadedFbIds.push(result.value);
        } else if (result.status === 'rejected') {
          this.logger.warn(
            `Failed to upload media at index ${index}: ${batch[index]}`,
            result.reason,
          );
        }
      });
    }

    return uploadedFbIds;
  }

  /** Handle single media upload (image, video, or reel) */
  private async uploadSingleMediaFile(
    pageId: string,
    mediaUrl: string,
    accessToken: string,
  ): Promise<string | null> {
    try {
      const mediaType = this.detectMediaType(mediaUrl);
      const endpoint = this.getEndpointForMediaType(mediaType);
      const uploadUrl = `${this.baseUrl}/${pageId}/${endpoint}`;
      const params = this.buildMediaUploadParams(
        mediaUrl,
        mediaType,
        accessToken,
      );

      console.log(`Uploading ${mediaType} to Facebook:`, {
      pageId,
      mediaUrl,
      endpoint,
      uploadUrl
    });
    console.log(`Upload params:`, params);

      const response = await firstValueFrom(
        this.http.post(uploadUrl, null, {
          params,
          timeout: this.uploadTimeout,
        }),
      );

      return response.data?.id || null;
    } catch (error) {
      this.logger.error(
        `Failed to upload media to Facebook: ${mediaUrl}`,
        error.stack || error.message,
      );
      return null;
    }
  }

  private buildScheduleParams(
    post: ScheduledPost,
    accessToken: string,
    mediaAttachments: string[],
  ): Record<string, any> {
    console.log(`post time`, post.scheduledAt);
    const localDate = new Date(post.scheduledAt);
    console.log(` scheduled time  in (utc):`, localDate);

    const utcSeconds = Math.floor(localDate.getTime() / 1000);
    console.log(`Scheduling Facebook post at UTC time:`, utcSeconds);

    const params: Record<string, any> = {
      message: post.content,
      scheduled_publish_time: utcSeconds, 
      published: false,
      access_token: accessToken,
    };

    if (mediaAttachments.length > 0) {
      params.attached_media = mediaAttachments.map((id) => ({
        media_fbid: id,
      }));
    }

    return params;
  }

  /** Build params for immediate publish */
  private buildPublishParams(
    post: ScheduledPost,
    accessToken: string,
    mediaAttachments: string[],
  ): Record<string, any> {
    const params: Record<string, any> = {
      message: post.content,
      access_token: accessToken,
    };

    if (mediaAttachments.length > 0) {
      params.attached_media = mediaAttachments.map((id) => ({
        media_fbid: id,
      }));
    }

    return params;
  }

  /** Build parameters for Facebook media upload */
  private buildMediaUploadParams(
    mediaUrl: string,
    mediaType: 'photo' | 'video' | 'reel',
    accessToken: string,
  ): Record<string, any> {
    switch (mediaType) {
      case 'photo':
        return { url: mediaUrl, published: false, access_token: accessToken };
      case 'video':
        return {
          file_url: mediaUrl,
          published: false,
          access_token: accessToken,
        };
      case 'reel':
        return {
          video_file_url: mediaUrl,
          published: false,
          access_token: accessToken,
        };
    }
  }

  /** Detect media type from URL */
  private detectMediaType(url: string): 'photo' | 'video' | 'reel' {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('reel')) {
      return 'reel';
    }

    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    if (videoExtensions.some((ext) => lowerUrl.includes(ext))) {
      return 'video';
    }

    return 'photo';
  }

  /** Get API endpoint for media type */
  private getEndpointForMediaType(
    mediaType: 'photo' | 'video' | 'reel',
  ): string {
    const endpoints = {
      photo: 'photos',
      video: 'videos',
      reel: 'video_reels',
    };
    return endpoints[mediaType];
  }

  /** Create batches from array */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /** Validate URL format */
  private isValidUrl(url: string): boolean {
    if (!url?.trim()) {
      return false;
    }
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /** Validate Facebook post data */
  private validateFacebookPost(
    post: ScheduledPost,
    requirePageId = false,
  ): void {
    if (!post) {
      throw new Error('Post data is required');
    }

    if (!post.metadata) {
      throw new Error('Post metadata is required');
    }

    if (requirePageId && !post.metadata.pageId?.trim()) {
      throw new Error('Page ID is required for Facebook page operations');
    }

    if (!post.metadata.accessToken?.trim()) {
      throw new Error('Access token is required');
    }

    if (post.content && post.content.length > this.maxContentLength) {
      throw new Error(
        `Facebook post content exceeds ${this.maxContentLength} character limit`,
      );
    }

    if (post.mediaUrls?.length) {
      const invalidUrls = post.mediaUrls.filter((url) => !this.isValidUrl(url));
      if (invalidUrls.length > 0) {
        throw new Error(`Invalid media URL format: ${invalidUrls.join(', ')}`);
      }
    }
  }
}
