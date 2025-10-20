// src/social-posting/clients/instagram.client.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  IPlatformClient,
  PlatformPost,
  PostingResult,
  MediaUploadData,
} from '../interfaces/platform-client.interface';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface InstagramMediaContainer {
  id: string;
  status: 'IN_PROGRESS' | 'ERROR' | 'FINISHED';
  status_code?: string;
}

@Injectable()
export class InstagramClient implements IPlatformClient {
  private readonly logger = new Logger(InstagramClient.name);
  private readonly apiBase = 'https://graph.instagram.com';
  private readonly uploadApiBase = 'https://graph.facebook.com'; // For uploads

  constructor(private readonly prisma: PrismaService) {}

  async publishPost(accountId: string, post: PlatformPost): Promise<PostingResult> {
    const accessToken = await this.getAccessToken(accountId);
    
    try {
      if (!post.mediaUrls?.length) {
        throw new Error('Instagram requires media for posts');
      }

      // For multiple media (carousel)
      if (post.mediaUrls.length > 1) {
        return await this.publishCarousel(accountId, post, accessToken);
      }

      // Single media post
      return await this.publishSingleMedia(accountId, post, accessToken);

    } catch (error) {
      this.logger.error(`Instagram publishing failed for account ${accountId}:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { platform: Platform.INSTAGRAM },
      };
    }
  }

  private async publishSingleMedia(accountId: string, post: PlatformPost, accessToken: string): Promise<PostingResult> {
    const mediaUrl = post.mediaUrls[0];
    const isVideo = await this.isVideoUrl(mediaUrl);

    // Step 1: Create media container
    const containerResult = await this.createMediaContainer(
      accountId, 
      mediaUrl, 
      post.content, 
      isVideo, 
      accessToken
    );

    // Step 2: Wait for container to be ready (for videos)
    if (isVideo) {
      const status = await this.waitForContainerReady(containerResult.id, accessToken);
      if (status !== 'FINISHED') {
        throw new Error(`Media container failed: ${status}`);
      }
    }

    // Step 3: Publish the container
    const publishResult = await this.publishContainer(accountId, containerResult.id, accessToken);

    return {
      success: true,
      platformPostId: publishResult.id,
      url: `https://instagram.com/p/${publishResult.id}`,
      message: 'Successfully published to Instagram',
      metadata: { 
        platform: Platform.INSTAGRAM,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        containerId: containerResult.id,
      },
    };
  }

  private async publishCarousel(accountId: string, post: PlatformPost, accessToken: string): Promise<PostingResult> {
    // Step 1: Create media containers for each item
    const containerIds: string[] = [];
    
    for (const mediaUrl of post.mediaUrls) {
      const isVideo = await this.isVideoUrl(mediaUrl);
      const container = await this.createMediaContainer(
        accountId, 
        mediaUrl, 
        '', // No caption for carousel items
        isVideo, 
        accessToken
      );
      
      if (isVideo) {
        const status = await this.waitForContainerReady(container.id, accessToken);
        if (status !== 'FINISHED') {
          throw new Error(`Carousel item failed: ${status}`);
        }
      }
      
      containerIds.push(container.id);
    }

    // Step 2: Create carousel container
    const carouselContainer = await this.createCarouselContainer(accountId, containerIds, post.content, accessToken);

    // Step 3: Publish carousel
    const publishResult = await this.publishContainer(accountId, carouselContainer.id, accessToken);

    return {
      success: true,
      platformPostId: publishResult.id,
      url: `https://instagram.com/p/${publishResult.id}`,
      message: 'Successfully published carousel to Instagram',
      metadata: { 
        platform: Platform.INSTAGRAM,
        mediaType: 'CAROUSEL',
        itemCount: containerIds.length,
      },
    };
  }

  private async createMediaContainer(
    accountId: string, 
    mediaUrl: string, 
    caption: string, 
    isVideo: boolean, 
    accessToken: string
  ): Promise<{ id: string }> {
    const payload: any = {
      caption: caption.substring(0, 2200), // Instagram caption limit
    };

    if (isVideo) {
      payload.video_url = mediaUrl;
      payload.media_type = 'VIDEO';
    } else {
      payload.image_url = mediaUrl;
      payload.media_type = 'IMAGE';
    }

    const response = await fetch(`${this.apiBase}/${accountId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram container creation failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async createCarouselContainer(
    accountId: string, 
    children: string[], 
    caption: string, 
    accessToken: string
  ): Promise<{ id: string }> {
    const response = await fetch(`${this.apiBase}/${accountId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        caption: caption.substring(0, 2200),
        children: children,
        media_type: 'CAROUSEL',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram carousel creation failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async publishContainer(accountId: string, containerId: string, accessToken: string): Promise<{ id: string }> {
    const response = await fetch(`${this.apiBase}/${accountId}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ creation_id: containerId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram publishing failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async waitForContainerReady(containerId: string, accessToken: string, maxAttempts = 30): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(2000); // Wait 2 seconds between checks

      const response = await fetch(`${this.apiBase}/${containerId}?fields=status,status_code`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) continue;

      const container: InstagramMediaContainer = await response.json();
      
      if (container.status === 'FINISHED') return 'FINISHED';
      if (container.status === 'ERROR') return 'ERROR';
      
      // Status is IN_PROGRESS, continue waiting
    }

    throw new Error('Media container processing timeout');
  }

  private async isVideoUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return contentType?.startsWith('video/') || false;
    } catch {
      return url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov');
    }
  }

  async uploadMedia(accountId: string, media: MediaUploadData): Promise<string> {
    // Instagram doesn't support direct media upload via API - media must be publicly accessible
    throw new Error('Instagram requires publicly accessible media URLs. Upload to CDN first.');
  }

  async validateCredentials(accountId: string): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return !!accountInfo.id;
    } catch (error) {
      this.logger.warn(`Instagram credentials validation failed:`, error);
      return false;
    }
  }

  async getAccountInfo(accountId: string): Promise<any> {
    const accessToken = await this.getAccessToken(accountId);
    
    const response = await fetch(
      `${this.apiBase}/${accountId}?fields=id,username,media_count,followers_count,website,name,biography`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.status}`);
    }

    return response.json();
  }

  private async getAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { accessToken: true, tokenExpiresAt: true },
    });

    if (!account?.accessToken) {
      throw new Error('Instagram access token not found');
    }

    // Check if token needs refresh (optional - would need refresh token implementation)
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      throw new Error('Instagram access token expired');
    }

    return account.accessToken;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}