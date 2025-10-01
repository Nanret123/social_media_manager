import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { SocialIntegrationService } from './social-integration.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OAuthCallbackDto } from './dtos/auth-callback.dto';
import { DisconnectAccountDto } from './dtos/disconnect-account.dto';
import { GetAuthUrlDto } from './dtos/get-auth-url.dto';
import { Platform } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { SelectAccountDto } from './dtos/select-account.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('Social Integration')
@ApiBearerAuth()
@Controller('social')
export class SocialIntegrationController {
  constructor(
    private readonly socialIntegrationService: SocialIntegrationService,
  ) {}

  /**
   * Generate OAuth URL for a given platform
   */
  @ApiOperation({ summary: 'Get OAuth URL for platform' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Maximum account limit reached' })
  @Get('auth-url')
  async getAuthUrl(@Query() query: GetAuthUrlDto, @Req() req) {
    try {
      const url = await this.socialIntegrationService.getAuthUrl(
        query.platform,
        query.organizationId,
        req.user.id,
      );
      return { url };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Handle OAuth callback
   */
  @ApiOperation({ summary: 'Handle OAuth callback for platform' })
  @ApiParam({
    name: 'provider',
    enum: ['FACEBOOK', 'X', 'LINKEDIN', 'INSTAGRAM'],
    description: 'OAuth provider to use',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Encrypted code returned by the provider',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth account connected successfully',
  })
  @ApiResponse({ status: 400, description: 'Failed to connect account' })
  @Get(':provider/callback')
  async handleOAuthCallback(
    @Query() body: OAuthCallbackDto,
    @Param('provider') provider: Platform,
  ) {
    return await this.socialIntegrationService.handleOAuthCallback(
      provider,
      body.code,
      decodeURIComponent(body.encryptedState),
    );
  }

  /**
   * Get all connected accounts for an organization
   */
  @ApiOperation({ summary: 'Get all connected social accounts' })
  @ApiResponse({
    status: 200,
    description: 'Connected accounts fetched successfully',
  })
//@Throttle(10, 60) 
  @Get('connected-accounts')
  async getConnectedAccounts(@Query('organizationId') organizationId: string) {
    return await this.socialIntegrationService.getConnectedAccounts(
      organizationId,
    );
  }

  /**
   * Disconnect a social account
   */
  @ApiOperation({ summary: 'Disconnect a social account' })
  @ApiResponse({
    status: 200,
    description: 'Social account disconnected successfully',
  })
  @ApiResponse({ status: 404, description: 'Social account not found' })
  @Post('disconnect')
  async disconnectAccount(@Body() body: DisconnectAccountDto) {
    await this.socialIntegrationService.disconnectAccount(
      body.accountId,
      body.organizationId,
    );
    return { success: true };
  }


@Get('profile/:accountId')
@Public()
  @ApiOperation({ summary: 'Get social account user profile' })
  @ApiParam({ name: 'accountId', description: 'ID of the social account' })
  @ApiResponse({
    status: 200,
    description: 'Fetched social profile successfully',
    schema: {
      example: {
        id: '123456',
        username: 'johndoe',
        name: 'John Doe',
        profilePicture: 'https://example.com/avatar.jpg',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Social account not found' })
  async getUserProfile(@Param('accountId') accountId: string) {
    return this.socialIntegrationService.getUserProfile(accountId);
  }
}
