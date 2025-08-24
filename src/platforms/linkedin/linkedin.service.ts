import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Redis } from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LinkedInService {
  private readonly baseURL = 'https://api.linkedin.com/v2';
  private readonly authURL = 'https://www.linkedin.com/oauth/v2';

  constructor(
    private httpService: HttpService,
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  // Generate LinkedIn OAuth URL
  getAuthURL(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: `${process.env.APP_URL}/api/auth/linkedin/callback`,
      state,
      scope: 'w_member_social r_liteprofile r_emailaddress',
    });

    return `${this.authURL}/authorization?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.APP_URL}/api/auth/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });

    try {
      const response$ = this.httpService.post(
        `${this.authURL}/accessToken`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const response = await firstValueFrom(response$);
      const tokenData = response.data;

      // Optional: Cache token in Redis with expiration
      if (this.redis) {
        await this.redis.set(
          `linkedin:token:${tokenData.access_token}`,
          JSON.stringify(tokenData),
          'EX',
          tokenData.expires_in,
        );
      }

      return tokenData;
    } catch (error) {
      throw new BadRequestException('Failed to exchange code for token');
    }
  }

  // Get LinkedIn user profile
  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response$ = this.httpService.get(`${this.baseURL}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to get LinkedIn profile');
    }
  }

  //Publish a post (immediate or via queue)
  async publishPost(post: any): Promise<any> {
    const postData = {
      author: `urn:li:person:${post.socialAccount.accountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.content },
          shareMediaCategory: post.media?.length ? 'IMAGE' : 'NONE',
          media: post.media?.map((m) => ({
            status: 'READY',
            description: { text: m.description || '' },
            media: m.url, // public URL from Cloudinary
            title: { text: m.title || '' },
          })),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    try {
      const response$ = this.httpService.post(`${this.baseURL}/ugcPosts`, postData, {
        headers: {
          Authorization: `Bearer ${post.socialAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error: any) {
      throw new BadRequestException(`Failed to publish LinkedIn post: ${error.message}`);
    }
  }
}
