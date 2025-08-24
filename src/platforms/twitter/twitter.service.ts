import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Platform } from '@prisma/client';
import Redis from 'ioredis';
import { EncryptionService } from 'src/common/utility/encryption.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import TwitterApi from 'twitter-api-v2';

@Injectable()
export class TwitterService {
  private readonly client: TwitterApi;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly encryptionService: EncryptionService,
  ) {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
    });
  }

  /**
   * Step 1: Generate Twitter auth URL and save request secret in Redis
   */
  async getAuthURL(userId: string): Promise<{ url: string }> {
  try {
    const authLink = await this.client.generateAuthLink(
      `${process.env.APP_URL}/api/auth/twitter/callback`,
      { linkMode: 'authorize' },
    );

    // Save both secret + userId in Redis
    const sessionData = JSON.stringify({
      oauth_token_secret: authLink.oauth_token_secret,
      userId,
    });

    await this.redis.setex(
      `twitter:req_secret:${authLink.oauth_token}`,
      600, // 10 minutes
      sessionData,
    );

    return { url: authLink.url };
  } catch (error) {
    console.error('Twitter Auth URL Error:', error);
    throw new InternalServerErrorException(
      'Failed to generate Twitter auth URL',
    );
  }
}

  /**
   * Step 2: Handle Twitter callback, exchange verifier for access tokens, and save user
   */
 async handleCallback(oauth_token: string, oauth_verifier: string) {
  try {
    // Get session data from Redis
    const sessionData = await this.redis.get(`twitter:req_secret:${oauth_token}`);
    if (!sessionData) throw new BadRequestException('Invalid or expired token');

    const { oauth_token_secret, userId } = JSON.parse(sessionData);

    // Create a temporary client
    const tempClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret,
    });

    // Exchange verifier for permanent access tokens
    const {
      client: loggedClient,
      accessToken,
      accessSecret,
    } = await tempClient.login(oauth_verifier);

    // Fetch Twitter user profile
    const userProfile = await loggedClient.v2.me({
      'user.fields': ['profile_image_url', 'name', 'username'],
    });

    // Encrypt tokens before saving
    const encryptedAccessToken = await this.encryptionService.encrypt(accessToken);
    const encryptedAccessSecret = await this.encryptionService.encrypt(accessSecret);

    // Save or update social account
    const socialAccount = await this.prisma.socialAccount.upsert({
      where: {
        userId_platform_accountId: {
          userId,
          platform: Platform.TWITTER,
          accountId: userProfile.data.id,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        accessSecret: encryptedAccessSecret,
        username: userProfile.data.username,
        displayName: userProfile.data.name,
        profileImage: userProfile.data.profile_image_url,
        isActive: true,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        platform: Platform.TWITTER,
        accountId: userProfile.data.id,
        username: userProfile.data.username,
        displayName: userProfile.data.name,
        profileImage: userProfile.data.profile_image_url,
        accessToken: encryptedAccessToken,
        accessSecret: encryptedAccessSecret,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });

    // Cleanup Redis
    await this.redis.del(`twitter:req_secret:${oauth_token}`);

    return socialAccount;
  } catch (error) {
    console.error('Twitter Callback Error:', error);
    throw new BadRequestException('Failed to authenticate with Twitter');
  }
}

async publishTweet(post: any, cloudinaryService:  FileUploadService): Promise<any> {
  const twitterClient = this.getUserClient(
    post.socialAccount.accessToken,
    post.socialAccount.accessSecret,
  );

  try {
    const mediaIds: string[] = [];

    if (post.mediaFiles && post.mediaFiles.length > 0) {
      // Upload all media to Cloudinary
      const uploadedFiles = await cloudinaryService.uploadMultipleFiles(post.mediaFiles);

      for (const file of uploadedFiles) {
        if (!('buffer' in file)) {
          // If your uploadFile doesn't return buffer, fetch it once here
          file['buffer'] = Buffer.from(await (await fetch(file.secure_url)).arrayBuffer());
        }

        // Upload directly to Twitter using the buffer
        const mediaId = await twitterClient.v1.uploadMedia(file.buffer);
        mediaIds.push(mediaId);
      }
    }

    // Create tweet
    const tweetData: any = { text: post.content };
    if (mediaIds.length > 0) {
      tweetData.media = { media_ids: mediaIds };
    }

    return await twitterClient.v2.tweet(tweetData);
  } catch (error) {
    throw new BadRequestException(`Failed to publish tweet: ${error.message}`);
  }
}



  private getUserClient(accessToken: string, accessSecret: string): TwitterApi {
    return new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken,
      accessSecret,
    });
  }
}
