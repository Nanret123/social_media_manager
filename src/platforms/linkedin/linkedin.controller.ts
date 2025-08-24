import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LinkedInService } from './linkedin.service';
import { PublishPostDto } from './dto/publish-post.dto';


@ApiTags('LinkedIn')
@Controller('api/auth/linkedin')
export class LinkedInController {
  constructor(private readonly linkedinService: LinkedInService) {}

  @Get('connect')
  @ApiOperation({ summary: 'Get LinkedIn OAuth authorization URL' })
  @ApiQuery({ name: 'state', required: true, description: 'CSRF protection string' })
  @ApiResponse({
    status: 200,
    description: 'Returns LinkedIn OAuth URL',
    schema: {
      example: {
        url: 'https://www.linkedin.com/oauth/v2/authorization?...',
      },
    },
  })
  getAuthUrl(@Query('state') state: string) {
    if (!state) throw new BadRequestException('State parameter is required');
    const url = this.linkedinService.getAuthURL(state);
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'LinkedIn OAuth callback (exchange code for token)' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  @ApiResponse({
    status: 200,
    description: 'Returns LinkedIn access token',
    schema: {
      example: {
        access_token: 'AQX...',
        expires_in: 5184000,
      },
    },
  })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code) throw new BadRequestException('Authorization code is required');
    return await this.linkedinService.exchangeCodeForToken(code);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Fetch authenticated LinkedIn user profile' })
  @ApiQuery({
    name: 'access_token',
    required: true,
    description: 'LinkedIn user access token',
  })
  @ApiResponse({
    status: 200,
    description: 'LinkedIn profile data',
    schema: {
      example: {
        id: 'abcd123',
        localizedFirstName: 'John',
        localizedLastName: 'Doe',
      },
    },
  })
  async getProfile(@Query('access_token') accessToken: string) {
    return await this.linkedinService.getUserProfile(accessToken);
  }

  @Post('post')
  @ApiOperation({ summary: 'Publish a post on LinkedIn (UGC Post)' })
  @ApiResponse({
    status: 201,
    description: 'Post published successfully',
    schema: {
      example: {
        id: 'urn:li:share:123456789',
      },
    },
  })
  async publishPost(@Body() postDto: PublishPostDto) {
    return await this.linkedinService.publishPost(postDto);
  }
}
