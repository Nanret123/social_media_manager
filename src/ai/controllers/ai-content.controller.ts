// src/ai/controllers/ai-content.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { AiContentService } from '../services/ai-content.service';
import { GenerateContentDto } from '../dtos/generate-content.dto';

@Controller('ai/content')
export class AiContentController {
  constructor(private readonly aiContentService: AiContentService) {}

  @Post('generate')
  async generateContent(@Body() generateDto: GenerateContentDto, @Req() req) {
    return this.aiContentService.generateContent(
      req.user.organizationId,
      req.user.id,
      generateDto,
    );
  }
}