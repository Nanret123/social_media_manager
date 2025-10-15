import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MetaService } from './meta.service';

@ApiTags('Meta Integration')
@ApiBearerAuth()
@Controller('social/meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('auth/url')
  @ApiOperation({
    summary: 'Generate Meta Business Login URL',
    description:
      'Generates the Meta (Facebook) Business Login URL that the user should be redirected to for OAuth authentication.',
  })
  @ApiResponse({ status: 200, description: 'Returns the login URL and state token.' })
  getAuthUrl(@Query('organizationId') organizationId: string, @Req() req) {
    return this.metaService.generateAuthUrl(organizationId, req.user.id);
  }

  @Get('auth/callback')
  @ApiOperation({
    summary: 'Handle Meta OAuth callback',
    description:
      'Handles the OAuth redirect from Facebook, exchanging the authorization code for a user access token.',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'encryptedState', required: true })
  @ApiResponse({ status: 200, description: 'Returns access token and expiry info.' })
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('encryptedState') encryptedState: string,
  ) {
    return this.metaService.handleOAuthCallback(code, decodeURIComponent(encryptedState),);
  }

  // -------------------------------------------------------------------------
  // USER PROFILE & VERIFICATION
  // -------------------------------------------------------------------------

  @Post('verify')
  @ApiOperation({
    summary: 'Verify Meta user access token',
    description:
      'Verifies if a provided Meta user access token is valid and retrieves user ID, scopes, and expiration.',
  })
  @ApiResponse({ status: 200, description: 'Returns token validation details.' })
  async verifyToken(@Body('accessToken') accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');
    return this.metaService.verifyUserAccessToken(accessToken);
  }

  @Post('me')
  @ApiOperation({
    summary: 'Get Meta user profile',
    description:
      'Fetches the Meta user profile (name, email, profile picture) using the provided user access token.',
  })
  @ApiResponse({ status: 200, description: 'Returns Facebook user profile data.' })
  async getProfile(@Body('accessToken') accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');
    return this.metaService.getUserProfile(accessToken);
  }

  // -------------------------------------------------------------------------
  // PAGES & BUSINESSES
  // -------------------------------------------------------------------------

  @Post('pages')
  @ApiOperation({
    summary: 'Get Meta pages user manages',
    description:
      'Fetches all Facebook Pages managed by the user and their linked Instagram Business Accounts using the user access token.',
  })
  @ApiResponse({ status: 200, description: 'Returns an array of pages with tokens and metadata.' })
  async getUserPages(@Body('accessToken') accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');
    return this.metaService.getUserPages(accessToken);
  }

  @Post('pages/sync/:socialAccountId')
  @ApiOperation({
    summary: 'Sync user’s Facebook pages to database',
    description:
      'Fetches all user pages and stores/updates them in the local database with encrypted page tokens.',
  })
  @ApiResponse({ status: 200, description: 'Returns array of synced page records.' })
  async syncUserPages(
    @Param('socialAccountId') socialAccountId: string,
    @Body('accessToken') accessToken: string,
  ) {
    if (!accessToken) throw new BadRequestException('accessToken is required');
    const pages = await this.metaService.getUserPages(accessToken);
    return this.metaService.syncUserPages(socialAccountId, pages);
  }

  @Get('businesses')
  @ApiOperation({
    summary: 'Get Facebook businesses user manages',
    description:
      'Fetches the list of businesses connected to the user’s account via Facebook Business Manager.',
  })
  @ApiQuery({ name: 'accessToken', required: true })
  async getBusinesses(@Query('accessToken') accessToken: string) {
    return this.metaService.getUserBusinesses(accessToken);
  }

  // -------------------------------------------------------------------------
  // INSTAGRAM & PAGE INSIGHTS
  // -------------------------------------------------------------------------

  @Get('pages/:pageId/instagram')
  @ApiOperation({
    summary: 'Get Instagram Business Account linked to a Facebook Page',
    description:
      'Fetches the Instagram Business Account connected to a given Facebook Page using the page access token.',
  })
  @ApiQuery({ name: 'pageAccessToken', required: true })
  async getInstagramAccount(
    @Param('pageId') pageId: string,
    @Query('pageAccessToken') pageAccessToken: string,
  ) {
    return this.metaService.getInstagramBusinessAccount(pageId, pageAccessToken);
  }

  @Get('pages/:pageId/insights')
  @ApiOperation({
    summary: 'Get Facebook Page Insights',
    description:
      'Fetches insights (e.g. page impressions, engagement) for a specific Facebook Page using its page access token.',
  })
  @ApiQuery({ name: 'pageAccessToken', required: true })
  @ApiQuery({
    name: 'metrics',
    required: false,
    description: 'Comma-separated list of metrics to retrieve (default: page_impressions)',
  })
  async getPageInsights(
    @Param('pageId') pageId: string,
    @Query('pageAccessToken') pageAccessToken: string,
    @Query('metrics') metrics?: string,
  ) {
    const metricList = metrics ? metrics.split(',') : ['page_impressions'];
    return this.metaService.getPageInsights(pageId, pageAccessToken, metricList);
  }

  // -------------------------------------------------------------------------
  // PUBLISHING
  // -------------------------------------------------------------------------

  @Post('instagram/publish')
  @ApiOperation({
    summary: 'Publish media to Instagram Business Account',
    description:
      'Publishes an image or video with a caption to a connected Instagram Business Account.',
  })
  @ApiResponse({ status: 200, description: 'Returns result of publish operation.' })
  async publishToInstagram(
    @Body()
    body: {
      instagramAccountId: string;
      pageAccessToken: string;
      imageUrl?: string;
      videoUrl?: string;
      caption?: string;
    },
  ) {
    const { instagramAccountId, pageAccessToken, ...content } = body;
    if (!instagramAccountId || !pageAccessToken)
      throw new BadRequestException('instagramAccountId and pageAccessToken are required');

    return this.metaService.publishToInstagram(instagramAccountId, pageAccessToken, content);
  }

  // -------------------------------------------------------------------------
  // DISCONNECT / TOKEN MANAGEMENT
  // -------------------------------------------------------------------------

  @Post('disconnect')
  @ApiOperation({
    summary: 'Revoke Facebook app permissions',
    description:
      'Revokes app permissions from the user’s Facebook account, effectively disconnecting the app.',
  })
  @ApiResponse({ status: 200, description: 'Revocation successful.' })
  async revokeAccess(@Body('accessToken') accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');
    return this.metaService.revokeToken(accessToken);
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate Facebook access token',
    description: 'Quickly validates whether a Facebook access token is still active and usable.',
  })
  @ApiResponse({ status: 200, description: 'Returns true if valid, false otherwise.' })
  async validateToken(@Body('accessToken') accessToken: string) {
    return this.metaService.validateAccessToken(accessToken);
  }
}

