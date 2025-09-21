import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AIService } from './ai.service';
import { 
  AIGenerationRequest, 
  ImageGenerationRequest,
  AIUsageMetrics 
} from './ai.types';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('generate-content')
  async generateContent(@Body() request: AIGenerationRequest, @CurrentUser() user: User ) {
    return this.aiService.generateContent(request);
  }

  @Post('generate-image')
  async generateImage(@Body() request: ImageGenerationRequest) {
    return this.aiService.generateImage(request);
  }

  @Post('optimize-content')
  async optimizeContent(
    @Body('content') content: string,
    @Body('platform') platform: string,
    @Body('targetAudience') targetAudience?: string
  ) {
    return this.aiService.optimizeContent(content, platform as any, targetAudience);
  }

  @Post('batch-generate')
  async batchGenerateContent(@Body() requests: AIGenerationRequest[]) {
    return this.aiService.batchGenerateContent(requests);
  }

  @Get('usage')
  async getUsageMetrics(@Query('organizationId') organizationId: string): Promise<AIUsageMetrics> {
    return this.aiService.getUsageMetrics(organizationId);
  }
}