import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TwitterService } from './twitter.service';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Twitter')
@Controller('twitter')
export class TwitterController {
  constructor(private readonly twitterService: TwitterService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Initiate Twitter authentication',
    description:
      'Redirects the user to Twitter login/consent screen. Requires user to be logged in (JWT).',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Twitter authorization URL',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to initiate Twitter authentication',
  })
  async connect(@CurrentUser() user: User, @Res() res: Response): Promise<void> {
    try {
      const { url } = await this.twitterService.getAuthURL(user.id);
      res.redirect(url);
    } catch (error) {
      throw new BadRequestException('Failed to initiate Twitter authentication');
    }
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Twitter OAuth callback',
    description:
      'Handles the OAuth callback from Twitter. Exchanges tokens and links the Twitter account to the logged-in user.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to dashboard with success or error message',
  })
  async callback(
    @Query('oauth_token') oauth_token: string,
    @Query('oauth_verifier') oauth_verifier: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!oauth_token || !oauth_verifier) {
        throw new BadRequestException('Missing OAuth parameters');
      }

      // Service fetches secret + userId from Redis and finalizes linking
      await this.twitterService.handleCallback(oauth_token, oauth_verifier);

      res.redirect('/dashboard?connected=twitter');
    } catch (error) {
      res.redirect('/dashboard?error=twitter_auth_failed');
    }
  }
}
