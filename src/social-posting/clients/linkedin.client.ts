// src/social-posting/clients/linkedin.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IPlatformClient,
  PlatformPost,
  PostingResult,
  MediaUploadData,
} from '../interfaces/platform-client.interface';

interface LinkedInMediaUploadResponse {
  value: {
    uploadUrl: string;
    uploadUrlExpiresAt: number;
    image: string;
  };
}

interface LinkedInShareResponse {
  id: string;
}

interface LinkedInVideoUploadResponse {
  value: {
    uploadUrl: string;
    uploadUrlExpiresAt: number;
    video: string;
  };
}

interface LinkedInPollOptions {
  questions: Array<{
    text: string;
  }>;
  duration: number; // Duration in seconds (86400, 604800, 2592000)
}

@Injectable()
export class LinkedInClient implements IPlatformClient {
  private readonly logger = new Logger(LinkedInClient.name);
  private readonly apiBase = 'https://api.linkedin.com/v2';
  private readonly uploadApiBase = 'https://api.linkedin.com/v2';
  private readonly maxImageSize = 50 * 1024 * 1024; // 50MB
  private readonly maxVideoSize = 5 * 1024 * 1024 * 1024; // 5GB

  constructor(private readonly prisma: PrismaService) {}

  async publishPost(
    accountId: string,
    post: PlatformPost,
  ): Promise<PostingResult> {
    const accessToken = await this.getAccessToken(accountId);
    const personUrn = await this.getPersonUrn(accountId);

    try {
      let result: LinkedInShareResponse;

      // Determine post type based on content and media
      if (post.options?.poll) {
        result = await this.publishPoll(post, personUrn, accessToken);
      } else if (post.mediaUrls?.length > 0) {
        if (post.mediaUrls.length > 1) {
          result = await this.publishCarousel(post, personUrn, accessToken);
        } else {
          const isVideo = await this.isVideoUrl(post.mediaUrls[0]);
          result = isVideo
            ? await this.publishVideo(post, personUrn, accessToken)
            : await this.publishImage(post, personUrn, accessToken);
        }
      } else {
        result = await this.publishText(post, personUrn, accessToken);
      }

      return {
        success: true,
        platformPostId: result.id,
        url: await this.getPostUrl(result.id, personUrn),
        message: 'Successfully published to LinkedIn',
        metadata: {
          platform: Platform.LINKEDIN,
          mediaCount: post.mediaUrls?.length || 0,
          postType: this.getPostType(post),
        },
      };
    } catch (error) {
      this.logger.error(`LinkedIn publishing failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { platform: Platform.LINKEDIN },
      };
    }
  }

  private async publishText(
    post: PlatformPost,
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInShareResponse> {
    const shareRequest = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000), // LinkedIn limit
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `LinkedIn text post failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async publishImage(
    post: PlatformPost,
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInShareResponse> {
    const mediaUrl = post.mediaUrls[0];

    // Step 1: Register image upload
    const uploadResponse = await this.registerImageUpload(
      personUrn,
      accessToken,
    );

    // Step 2: Upload image to LinkedIn
    await this.uploadImageToLinkedIn(mediaUrl, uploadResponse.value.uploadUrl);

    // Step 3: Create post with image
    const shareRequest = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000),
          },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              description: {
                text: post.content.substring(0, 255), // Image description limit
              },
              media: uploadResponse.value.image,
              title: {
                text: 'Shared Image',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `LinkedIn image post failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async publishVideo(
    post: PlatformPost,
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInShareResponse> {
    const mediaUrl = post.mediaUrls[0];

    // Step 1: Register video upload
    const uploadResponse = await this.registerVideoUpload(
      personUrn,
      accessToken,
    );

    // Step 2: Upload video to LinkedIn in chunks
    await this.uploadVideoToLinkedIn(mediaUrl, uploadResponse.value.uploadUrl);

    // Step 3: Create post with video (LinkedIn processes videos asynchronously)
    const shareRequest = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000),
          },
          shareMediaCategory: 'VIDEO',
          media: [
            {
              status: 'READY',
              description: {
                text: post.content.substring(0, 255),
              },
              media: uploadResponse.value.video,
              title: {
                text: 'Shared Video',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `LinkedIn video post failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async publishCarousel(
    post: PlatformPost,
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInShareResponse> {
    // LinkedIn doesn't support native carousels, so we create an article with multiple images
    const shareRequest = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000),
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              description: {
                text: 'Multiple images',
              },
              originalUrl: post.mediaUrls[0], // Use first image as primary
              title: {
                text: 'Image Collection',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `LinkedIn carousel post failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async publishPoll(
    post: PlatformPost,
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInShareResponse> {
    const pollOptions: LinkedInPollOptions = post.options.poll;

    const shareRequest = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000),
          },
          shareMediaCategory: 'NONE',
          poll: {
            questions: pollOptions.questions.slice(0, 4), // Max 4 questions
            duration: pollOptions.duration,
          },
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `LinkedIn poll post failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async registerImageUpload(
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInMediaUploadResponse> {
    const registerRequest = {
      registerUploadRequest: {
        owner: personUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    const response = await fetch(
      `${this.uploadApiBase}/assets?action=registerUpload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(registerRequest),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Image upload registration failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async registerVideoUpload(
    personUrn: string,
    accessToken: string,
  ): Promise<LinkedInVideoUploadResponse> {
    const registerRequest = {
      registerUploadRequest: {
        owner: personUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    const response = await fetch(
      `${this.uploadApiBase}/assets?action=registerUpload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(registerRequest),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Video upload registration failed: ${response.status} - ${error}`,
      );
    }

    return response.json();
  }

  private async uploadImageToLinkedIn(
    mediaUrl: string,
    uploadUrl: string,
  ): Promise<void> {
    const imageBuffer = await this.downloadMedia(mediaUrl);

    if (imageBuffer.length > this.maxImageSize) {
      throw new Error(
        `Image size exceeds LinkedIn limit of ${this.maxImageSize} bytes`,
      );
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: new Uint8Array(imageBuffer),
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });

    if (!response.ok) {
      throw new Error(`Image upload failed: ${response.status}`);
    }
  }

  private async uploadVideoToLinkedIn(
    mediaUrl: string,
    uploadUrl: string,
  ): Promise<void> {
    const videoBuffer = await this.downloadMedia(mediaUrl);

    if (videoBuffer.length > this.maxVideoSize) {
      throw new Error(
        `Video size exceeds LinkedIn limit of ${this.maxVideoSize} bytes`,
      );
    }

    // LinkedIn requires chunked upload for large videos
    if (videoBuffer.length > 50 * 1024 * 1024) {
      // 50MB
      await this.uploadVideoInChunks(videoBuffer, uploadUrl);
    } else {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: new Uint8Array(videoBuffer),
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      if (!response.ok) {
        throw new Error(`Video upload failed: ${response.status}`);
      }
    }
  }

  private async uploadVideoInChunks(
    videoBuffer: Buffer,
    uploadUrl: string,
  ): Promise<void> {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(videoBuffer.length / chunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, videoBuffer.length);
      const chunk = videoBuffer.slice(start, end);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: chunk,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${start}-${end - 1}/${videoBuffer.length}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Video chunk upload failed: ${response.status}`);
      }

      this.logger.log(`Uploaded video chunk ${chunkIndex + 1}/${totalChunks}`);
    }
  }

  async uploadMedia(
    accountId: string,
    media: MediaUploadData,
  ): Promise<string> {
    const accessToken = await this.getAccessToken(accountId);
    const personUrn = await this.getPersonUrn(accountId);

    if (media.mimeType?.startsWith('video/')) {
      const uploadResponse = await this.registerVideoUpload(
        personUrn,
        accessToken,
      );
      await this.uploadVideoToLinkedIn(
        await this.bufferToDataUrl(media.buffer, media.mimeType),
        uploadResponse.value.uploadUrl,
      );
      return uploadResponse.value.video;
    } else {
      const uploadResponse = await this.registerImageUpload(
        personUrn,
        accessToken,
      );
      await this.uploadImageToLinkedIn(
        await this.bufferToDataUrl(media.buffer, media.mimeType),
        uploadResponse.value.uploadUrl,
      );
      return uploadResponse.value.image;
    }
  }

  async validateCredentials(accountId: string): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(accountId);
      return !!accountInfo.id;
    } catch (error) {
      this.logger.warn(`LinkedIn credentials validation failed:`, error);
      return false;
    }
  }

  async getAccountInfo(accountId: string): Promise<any> {
    const accessToken = await this.getAccessToken(accountId);
    const personUrn = await this.getPersonUrn(accountId);

    const response = await fetch(
      `${this.apiBase}/people/(id:${personUrn.replace('urn:li:person:', '')})?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    return response.json();
  }

  private async getPersonUrn(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { platformAccountId: true },
    });

    if (!account?.platformAccountId) {
      throw new Error('LinkedIn person URN not found');
    }

    return account.platformAccountId;
  }

  private async getAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { accessToken: true, tokenExpiresAt: true },
    });

    if (!account?.accessToken) {
      throw new Error('LinkedIn access token not found');
    }

    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      throw new Error('LinkedIn access token expired');
    }

    return account.accessToken;
  }

  private async getPostUrl(postId: string, personUrn: string): Promise<string> {
    // LinkedIn doesn't provide direct URLs in API response, so we construct it
    const personId = personUrn.replace('urn:li:person:', '');
    return `https://www.linkedin.com/feed/update/${postId}`;
  }

  private async isVideoUrl(url: string): Promise<boolean> {
    return (
      url.toLowerCase().includes('.mp4') ||
      url.toLowerCase().includes('.mov') ||
      url.toLowerCase().includes('.avi')
    );
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

  private getPostType(post: PlatformPost): string {
    if (post.options?.poll) return 'POLL';
    if (post.mediaUrls?.length > 1) return 'CAROUSEL';
    if (post.mediaUrls?.length === 1) {
      return this.isVideoUrl(post.mediaUrls[0]) ? 'VIDEO' : 'IMAGE';
    }
    return 'TEXT';
  }

  // Additional LinkedIn-specific methods
  async getCompanyPages(accountId: string): Promise<any[]> {
    const accessToken = await this.getAccessToken(accountId);
    const personUrn = await this.getPersonUrn(accountId);

    const response = await fetch(
      `${this.apiBase}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(organizationalTarget~(id,localizedName,vanityName,logoV2(original~:playableStreams)))`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch company pages: ${response.status}`);
    }

    const result = await response.json();
    return result.elements || [];
  }

  async publishToCompanyPage(
    accountId: string,
    pageUrn: string,
    post: PlatformPost,
  ): Promise<PostingResult> {
    const accessToken = await this.getAccessToken(accountId);

    // Similar to personal posts but with page URN as author
    const shareRequest = {
      author: pageUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.content.substring(0, 3000),
          },
          shareMediaCategory: post.mediaUrls?.length ? 'IMAGE' : 'NONE',
          media: post.mediaUrls?.length
            ? [
                {
                  status: 'READY',
                  description: { text: post.content.substring(0, 255) },
                  originalUrl: post.mediaUrls[0],
                  title: { text: 'Shared Content' },
                },
              ]
            : undefined,
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(`${this.apiBase}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Company page post failed: ${response.status} - ${error}`,
      );
    }

    const result = await response.json();

    return {
      success: true,
      platformPostId: result.id,
      url: await this.getPostUrl(result.id, pageUrn),
      message: 'Successfully published to LinkedIn Company Page',
      metadata: { platform: Platform.LINKEDIN, isCompanyPage: true },
    };
  }
}
