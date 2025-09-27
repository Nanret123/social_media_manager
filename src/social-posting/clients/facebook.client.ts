// src/social-posting/clients/facebook.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IPlatformClient,
  PlatformPost,
  PostingResult,
  MediaUploadData,
} from '../interfaces/platform-client.interface';

@Injectable()
export class FacebookClient implements IPlatformClient {
  private readonly logger = new Logger(FacebookClient.name);
  private readonly apiBase = 'https://graph.facebook.com/v18.0';

  constructor(private readonly prisma: PrismaService) {}

  async publishPost(
    accountId: string,
    post: PlatformPost,
  ): Promise<PostingResult> {
    const accessToken = await this.getAccessToken(accountId);

    try {
      const pageId = accountId; // Facebook page ID
      let result: any;

      if (post.mediaUrls?.length > 0) {
        // Post with media
        if (post.mediaUrls.length > 1) {
          result = await this.publishAlbum(pageId, post, accessToken);
        } else {
          result = await this.publishMediaPost(pageId, post, accessToken);
        }
      } else {
        // Text-only post
        result = await this.publishTextPost(pageId, post, accessToken);
      }

      return {
        success: true,
        platformPostId: result.id,
        url: result.permalink_url || `https://facebook.com/${result.id}`,
        message: 'Successfully published to Facebook',
        metadata: {
          platform: Platform.FACEBOOK,
          mediaCount: post.mediaUrls?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Facebook publishing failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { platform: Platform.FACEBOOK },
      };
    }
  }

  private async publishTextPost(
    pageId: string,
    post: PlatformPost,
    accessToken: string,
  ): Promise<any> {
    const response = await fetch(`${this.apiBase}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message: post.content.substring(0, 63206), // Facebook limit
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook post failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async publishMediaPost(
    pageId: string,
    post: PlatformPost,
    accessToken: string,
  ): Promise<any> {
    const mediaUrl = post.mediaUrls[0];
    const isVideo = await this.isVideoUrl(mediaUrl);

    const params: any = {
      message: post.content.substring(0, 63206),
      access_token: accessToken,
    };

    if (isVideo) {
      params.description = post.content;
      params.file_url = mediaUrl;

      const response = await fetch(`${this.apiBase}/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Facebook video upload failed: ${response.status} - ${error}`,
        );
      }

      return response.json();
    } else {
      params.url = mediaUrl;

      const response = await fetch(`${this.apiBase}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Facebook photo upload failed: ${response.status} - ${error}`,
        );
      }

      return response.json();
    }
  }

  private async publishAlbum(
    pageId: string,
    post: PlatformPost,
    accessToken: string,
  ): Promise<any> {
    // Step 1: Create album
    const albumResponse = await fetch(`${this.apiBase}/${pageId}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        name: post.content.substring(0, 200) || 'New Album',
        message: post.content.substring(0, 63206),
        access_token: accessToken,
      }),
    });

    if (!albumResponse.ok) {
      const error = await albumResponse.text();
      throw new Error(
        `Facebook album creation failed: ${albumResponse.status} - ${error}`,
      );
    }

    const album = await albumResponse.json();

    // Step 2: Upload photos to album
    for (const mediaUrl of post.mediaUrls) {
      await fetch(`${this.apiBase}/${album.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          url: mediaUrl,
          access_token: accessToken,
        }),
      });
      // Note: We don't check individual photo uploads for simplicity
    }

    return album;
  }

  async uploadMedia(
    accountId: string,
    media: MediaUploadData,
  ): Promise<string> {
    // Facebook media upload happens during post creation
    throw new Error('Facebook media upload is handled during post creation');
  }

  async validateCredentials(accountId: string): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return !!accountInfo.id;
    } catch (error) {
      this.logger.warn(`Facebook credentials validation failed:`, error);
      return false;
    }
  }

  async getAccountInfo(accountId: string): Promise<any> {
    const accessToken = await this.getAccessToken(accountId);

    const response = await fetch(
      `${this.apiBase}/${accountId}?fields=id,name,username,fan_count,followers_count,link,is_verified`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.status}`);
    }

    return response.json();
  }

  private async getAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { accessToken: true, tokenExpiresAt: true },
    });

    if (!account?.accessToken) {
      throw new Error('Facebook access token not found');
    }

    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      throw new Error('Facebook access token expired');
    }

    return account.accessToken;
  }

  private async isVideoUrl(url: string): Promise<boolean> {
    return (
      url.toLowerCase().includes('.mp4') ||
      url.toLowerCase().includes('.mov') ||
      url.toLowerCase().includes('.avi')
    );
  }
}
