import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
  Get,
  Delete,
  Req,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { GenerateContentDto } from './dtos/generate-content.dto';
import { AiContentService } from './services/ai-content.service';
import { EnhanceContentDto } from './dtos/enhance-content.dto';
import { RateLimitGuard } from 'src/common/guards/rate-limiter.guard';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { GenerateImageDto } from './dtos/generate-image.dto';
import { AiImageService } from './services/ai-image.service';
import { AiUsageService } from './services/ai-usage.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai/:organizationId')
@UseGuards(RateLimitGuard)
export class AiController {
  constructor(
    private readonly aiContentService: AiContentService,
    private readonly aiImageService: AiImageService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  @Post('generate/content')
  @UseGuards(RateLimitGuard)
  //@RateLimit('CONTENT_GENERATION') // action name used in RateLimitService
  @ApiOperation({ summary: 'Generate AI-powered content' })
  async generateContent(
    @CurrentUser('id') userId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: GenerateContentDto,
  ) {
    return this.aiContentService.generateContent(organizationId, userId, dto);
  }

  @Post('enhance')
  @UseGuards(RateLimitGuard)
  @RateLimit('CONTENT_ENHANCEMENT')
  @ApiOperation({ summary: 'Enhance AI-generated content' })
  async enhanceContent(
    @CurrentUser('id') userId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: EnhanceContentDto,
  ) {
    return this.aiContentService.enhanceContent(dto.contentId, {
      platform: dto.platform,
      tone: dto.tone,
      style: dto.style,
      brandKit:
        await this.aiContentService['brandKitService'].getActiveBrandKit(
          organizationId,
        ),
      organizationId,
      userId,
    });
  }

  @Post('generate/image')
  @UseGuards(RateLimitGuard)
  @RateLimit('image_generation')
  @ApiOperation({ summary: 'Generate an AI image based on prompt' })
  @ApiBody({ type: GenerateImageDto })
  @ApiResponse({ status: 201, description: 'AI image generated successfully' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async generateImage(
    @CurrentUser('id') userId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: GenerateImageDto,
  ) {
    return this.aiImageService.generateImage(organizationId, userId, dto);
  }

  @Get('monthly/:organizationId/usage')
  @ApiOperation({ summary: 'Get current month AI usage for organization' })
  @ApiResponse({
    status: 200,
    description: 'Returns monthly AI usage summary',
    schema: {
      example: {
        cost: 12.5,
        tokens: 4500,
      },
    },
  })
  async getMonthlyUsage(@Param('organizationId') orgId: string) {
    return this.aiUsageService.getMonthlyUsage(orgId);
  }
}
