import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AIGenerationRequest,
  AIGenerationResponse,
  ImageGenerationRequest,
  ContentOptimization,
  ImageGenerationResult,
  RequestContext,
} from './ai.types';
import { ContentOptimizer } from './content-optimizer';
import { PromptTemplates } from './prompt-templates';
import { OpenAIService } from './providers/openai.service';
import { StableDiffusionService } from './providers/stable-diffusion.service';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly costPerToken =
    parseFloat(process.env.AI_COST_PER_TOKEN) || 0.00002;
  private readonly imageCreditCost =
    parseInt(process.env.AI_IMAGE_CREDIT_COST) || 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly stableDiffusionService: StableDiffusionService,
    private readonly contentOptimizer: ContentOptimizer,
  ) {}

  /**
   * Generate text content with AI
   */
  async generateContent(
    request: AIGenerationRequest,
    context: RequestContext,
  ): Promise<AIGenerationResponse> {
    return this.prisma.$transaction(async (tx) => {
      const { prompt, tone, platform, contentType, maxLength } = request;

      try {
        // Generate main content
        const contentPrompt = PromptTemplates.generateCaptionPrompt(
          prompt,
          tone,
          platform,
          maxLength,
        );

        const contentResponse = await this.openAIService.createCompletion({
          model: 'gpt-4',
          prompt: contentPrompt,
          max_tokens: maxLength ? Math.min(maxLength, 500) : 500,
          temperature: 0.8,
        });

        // Generate hashtags
        const hashtagPrompt = PromptTemplates.generateHashtagPrompt(
          prompt,
          platform,
        );
        const hashtagResponse = await this.openAIService.createCompletion({
          model: 'gpt-3.5-turbo',
          prompt: hashtagPrompt,
          max_tokens: 100,
          temperature: 0.5,
        });

        const content = contentResponse.choices[0].text.trim();
        const hashtags = this.parseHashtags(hashtagResponse.choices[0].text);

        const totalTokens =
          contentResponse.usage.total_tokens +
          hashtagResponse.usage.total_tokens;
        const cost = this.calculateCost(totalTokens);

        // Create AI generation record
        const aiGeneration = await tx.aiContentGeneration.create({
          data: {
            organizationId: context.organizationId,
            userId: context.userId,
            platform: platform,
            contentType: contentType,
            topic: prompt.substring(0, 100),
            tone: tone,
            prompt: prompt,
            generatedText: content,
            hashtags: hashtags,
            creditsUsed: totalTokens,
            cost: cost,
            provider: 'openai',
            model: 'gpt-4',
            brandKitId: context.brandKitId,
          },
        });

        // Log usage
        await this.logUsage(tx, {
          type: 'content_generation',
          tokensUsed: totalTokens,
          cost: cost,
          organizationId: context.organizationId,
          userId: context.userId,
          metadata: {
            platform,
            tone,
            contentType,
            generationId: aiGeneration.id,
          },
        });

        return {
          content,
          hashtags,
          tokensUsed: totalTokens,
          cost,
          generationId: aiGeneration.id,
        };
      } catch (error) {
        this.logger.error('Content generation failed:', error);
        throw new Error(`Content generation failed: ${error.message}`);
      }
    });
  }

  /**
   * Generate image with AI (returns buffer, not uploaded)
   */
  async generateImage(
    request: ImageGenerationRequest,
    context: RequestContext,
  ): Promise<ImageGenerationResult> {
    return this.prisma.$transaction(async (tx) => {
      const { prompt, style, aspectRatio } = request;

      try {
        const imagePrompt = PromptTemplates.generateImagePrompt(
          prompt,
          style,
          aspectRatio,
        );

        // Generate image using Stable Diffusion
        const { imageUrl, revisedPrompt } =
          await this.stableDiffusionService.generateImage({
            prompt: imagePrompt,
            style,
            aspectRatio,
          });

        // Fetch image buffer from URL
        const imageBuffer = await this.fetchImageBuffer(imageUrl);
        const cost = this.calculateCost(this.imageCreditCost);

        // Create AI image generation record
        const imageGeneration = await tx.aiImageGeneration.create({
          data: {
            organizationId: context.organizationId,
            userId: context.userId,
            prompt: prompt,
            revisedPrompt: revisedPrompt,
            creditsUsed: this.imageCreditCost,
            cost: cost,
            provider: 'stability-ai',
            model: 'stable-diffusion',
            brandKitId: context.brandKitId,
          },
        });

        // Log usage
        await this.logUsage(tx, {
          type: 'image_generation',
          tokensUsed: this.imageCreditCost,
          cost: cost,
          organizationId: context.organizationId,
          userId: context.userId,
          metadata: {
            style,
            aspectRatio,
            generationId: imageGeneration.id,
          },
        });

        return {
          imageBuffer,
          revisedPrompt: revisedPrompt,
          generationId: imageGeneration.id,
          tokensUsed: this.imageCreditCost,
          cost,
        };
      } catch (error) {
        this.logger.error('Image generation failed:', error);
        throw new Error(`Image generation failed: ${error.message}`);
      }
    });
  }

  /**
   * Optimize content using AI
   */
  async optimizeContent(
    content: string,
    platform: Platform,
    targetAudience?: string,
    context?: RequestContext,
  ): Promise<ContentOptimization> {
    try {
      const optimization = await this.contentOptimizer.optimizeContent(
        content,
        platform,
        targetAudience,
      );

      // Log usage if context is provided
      if (context) {
        await this.logUsage(this.prisma, {
          type: 'content_optimization',
          tokensUsed: 200, // Estimated token usage
          cost: this.calculateCost(200),
          organizationId: context.organizationId,
          userId: context.userId,
          metadata: {
            platform,
            originalLength: content.length,
            optimizedLength: optimization.optimized.length,
          },
        });
      }

      return optimization;
    } catch (error) {
      this.logger.error('Content optimization failed:', error);
      throw new Error(`Content optimization failed: ${error.message}`);
    }
  }

  /**
   * Batch generate content with rate limiting
   */
  async batchGenerateContent(
    requests: AIGenerationRequest[],
    context: RequestContext,
    batchSize: number = 3,
  ): Promise<AIGenerationResponse[]> {
    const results: AIGenerationResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((request) => this.generateContent(request, context)),
      );

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.warn(
            `Batch generation failed for request ${i + index}:`,
            result.reason,
          );
          // Optionally add error result or rethrow
        }
      });

      // Respect rate limits
      if (i + batchSize < requests.length) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * Get AI usage metrics for organization
   */
  async getUsageMetrics(
    organizationId: string,
    days: number = 30,
  ): Promise<{
    totalTokens: number;
    totalCost: number;
    generationsCount: number;
    averageCostPerGeneration: number;
    usageByType: Record<string, number>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await this.prisma.aIUsage.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
    });

    const totalTokens = usage.reduce((sum, u) => sum + u.tokensUsed, 0);
    const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);

    // Group usage by type
    const usageByType = usage.reduce(
      (acc, u) => {
        acc[u.type] = (acc[u.type] || 0) + u.tokensUsed;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTokens,
      totalCost,
      generationsCount: usage.length,
      averageCostPerGeneration: usage.length > 0 ? totalCost / usage.length : 0,
      usageByType,
    };
  }

  /**
   * Fetch image buffer from URL
   */
  private async fetchImageBuffer(imageUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error('Failed to fetch image buffer:', error);
      throw new Error(`Failed to fetch image: ${error.message}`);
    }
  }

  /**
   * Parse hashtags from AI response
   */
  private parseHashtags(hashtagText: string): string[] {
    return hashtagText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.startsWith('#') && tag.length > 1)
      .map((tag) => tag.replace(/\s+/g, ''))
      .slice(0, 15);
  }

  /**
   * Calculate cost based on tokens
   */
  private calculateCost(tokens: number): number {
    return tokens * this.costPerToken;
  }

  /**
   * Log AI usage
   */
  private async logUsage(
    prisma: PrismaService | any,
    data: {
      type: string;
      tokensUsed: number;
      cost: number;
      organizationId: string;
      userId: string;
      metadata?: any;
    },
  ): Promise<void> {
    try {
      await prisma.aIUsage.create({
        data: {
          type: data.type,
          tokensUsed: data.tokensUsed,
          cost: data.cost,
          organizationId: data.organizationId,
          userId: data.userId,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      this.logger.warn('Failed to log AI usage:', error);
      // Don't throw - usage logging shouldn't break the main operation
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
