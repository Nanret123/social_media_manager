// src/social-posting/clients/twitter.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IPlatformClient,
  PlatformPost,
  PostingResult,
  MediaUploadData,
} from '../interfaces/platform-client.interface';

interface TwitterMediaUpload {
  media_id_string: string;
  size: number;
  expires_after_secs: number;
}

interface TwitterTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

@Injectable()
export class TwitterClient implements IPlatformClient {
  private readonly logger = new Logger(TwitterClient.name);
  private readonly apiBase = 'https://api.twitter.com/2';
  private readonly uploadApiBase = 'https://upload.twitter.com/1.1';

  constructor(private readonly prisma: PrismaService) {}

  async publishPost(
    accountId: string,
    post: PlatformPost,
  ): Promise<PostingResult> {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } =
      await this.getTwitterCredentials(accountId);

    try {
      let mediaIds: string[] = [];

      // Upload media first if present
      if (post.mediaUrls?.length > 0) {
        mediaIds = await this.uploadMediaFiles(
          post.mediaUrls,
          apiKey,
          apiSecret,
          accessToken,
          accessTokenSecret,
        );
      }

      // Publish tweet with media
      const tweetResult = await this.publishTweet(
        post.content,
        mediaIds,
        apiKey,
        apiSecret,
        accessToken,
        accessTokenSecret,
      );

      return {
        success: true,
        platformPostId: tweetResult.data.id,
        url: `https://twitter.com/user/status/${tweetResult.data.id}`,
        message: 'Successfully published to Twitter',
        metadata: {
          platform: Platform.X,
          mediaCount: mediaIds.length,
          characterCount: post.content.length,
        },
      };
    } catch (error) {
      this.logger.error(`Twitter publishing failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { platform: Platform.X },
      };
    }
  }

  private async publishTweet(
    content: string,
    mediaIds: string[],
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<TwitterTweetResponse> {
    const payload: any = {
      text: content.substring(0, 280), // Twitter character limit
    };

    if (mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds.slice(0, 4) }; // Twitter max 4 media items
    }

    const authHeader = this.createTwitterAuthHeader(
      'POST',
      `${this.apiBase}/tweets`,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    );

    const response = await fetch(`${this.apiBase}/tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter tweet failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async uploadMedia(
    accountId: string,
    media: MediaUploadData,
  ): Promise<string> {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } =
      await this.getTwitterCredentials(accountId);

    const mediaIds = await this.uploadMediaFiles(
      [await this.bufferToDataUrl(media.buffer, media.mimeType)],
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    );

    return mediaIds[0];
  }

  private async uploadMediaFiles(
    mediaUrls: string[],
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const mediaUrl of mediaUrls) {
      try {
        const mediaBuffer = await this.downloadMedia(mediaUrl);
        const mediaData = await this.bufferToDataUrl(mediaBuffer, 'image/jpeg'); // Default MIME type

        const authHeader = this.createTwitterAuthHeader(
          'POST',
          `${this.uploadApiBase}/media/upload.json`,
          apiKey,
          apiSecret,
          accessToken,
          accessTokenSecret,
        );

        const formData = new FormData();
        formData.append('media_data', mediaData);

        const response = await fetch(
          `${this.uploadApiBase}/media/upload.json`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
            },
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`Media upload failed: ${response.status}`);
        }

        const uploadResult: TwitterMediaUpload = await response.json();
        mediaIds.push(uploadResult.media_id_string);

        // Wait for media processing if needed
        await this.waitForMediaProcessing(
          uploadResult.media_id_string,
          apiKey,
          apiSecret,
          accessToken,
          accessTokenSecret,
        );
      } catch (error) {
        this.logger.error(
          `Twitter media upload failed for ${mediaUrl}:`,
          error,
        );
        throw error;
      }
    }

    return mediaIds;
  }

  private async waitForMediaProcessing(
    mediaId: string,
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
    maxAttempts = 10,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(1000);

      const authHeader = this.createTwitterAuthHeader(
        'GET',
        `${this.uploadApiBase}/media/upload.json?command=STATUS&media_id=${mediaId}`,
        apiKey,
        apiSecret,
        accessToken,
        accessTokenSecret,
      );

      const response = await fetch(
        `${this.uploadApiBase}/media/upload.json?command=STATUS&media_id=${mediaId}`,
        {
          headers: { Authorization: authHeader },
        },
      );

      if (response.ok) {
        const status = await response.json();
        if (status.processing_info?.state === 'succeeded') {
          return;
        }
        if (status.processing_info?.state === 'failed') {
          throw new Error('Media processing failed');
        }
      }
    }

    throw new Error('Media processing timeout');
  }

  async validateCredentials(accountId: string): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return !!accountInfo.data?.id;
    } catch (error) {
      this.logger.warn(`Twitter credentials validation failed:`, error);
      return false;
    }
  }

  async getAccountInfo(accountId: string): Promise<any> {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } =
      await this.getTwitterCredentials(accountId);

    const authHeader = this.createTwitterAuthHeader(
      'GET',
      `${this.apiBase}/users/me`,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    );

    const response = await fetch(
      `${this.apiBase}/users/me?user.fields=description,profile_image_url,public_metrics`,
      {
        headers: { Authorization: authHeader },
      },
    );

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }

    return response.json();
  }

  private async getTwitterCredentials(accountId: string) {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: {
        accessToken: true,
        refreshToken: true, // API Secret stored as refreshToken
        tokenExpiresAt: true,
        platformAccountId: true, // API Key stored as platformAccountId
      },
    });

    if (
      !account?.accessToken ||
      !account?.platformAccountId ||
      !account?.refreshToken
    ) {
      throw new Error('Twitter credentials not found');
    }

    return {
      apiKey: account.platformAccountId,
      apiSecret: account.refreshToken,
      accessToken: account.accessToken,
      accessTokenSecret: account.accessToken, // Simplified - in reality you'd store this separately
    };
  }

  private createTwitterAuthHeader(
    method: string,
    url: string,
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string,
  ): string {
    // Simplified OAuth 1.0a implementation
    // In production, use a proper OAuth library like 'oauth-1.0a'
    const oauth = {
      consumer_key: apiKey,
      consumer_secret: apiSecret,
      token: accessToken,
      token_secret: accessTokenSecret,
    };

    // This is a simplified version - implement proper OAuth 1.0a signing
    return `OAuth oauth_consumer_key="${apiKey}", oauth_token="${accessToken}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${Math.floor(Date.now() / 1000)}", oauth_nonce="${Math.random().toString(36).substring(2)}", oauth_version="1.0"`;
  }

  private async downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async bufferToDataUrl(
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
