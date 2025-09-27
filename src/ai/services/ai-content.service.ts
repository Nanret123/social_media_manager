import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Platform, ToneType } from '@prisma/client';
import { BrandKitService } from 'src/brand-kit/brand-kit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateContentDto } from '../dtos/generate-content.dto';
import { OpenAiProvider } from '../providers/openai.service';
import { AiUsageService } from './ai-usage.service';
import { RateLimitService } from 'src/rate-limit/rate-limit.service';

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandKitService: BrandKitService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly aiUsageService: AiUsageService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async generateContent(
    organizationId: string,
    userId: string,
    generateDto: GenerateContentDto,
  ) {
    const start = Date.now();

    try {
      // 1. Rate limits
      await this.rateLimitService.checkLimit(
        'AI',
        organizationId,
        'content_generation',
      );

      // 2. BrandKit
      const brandKit =
        (await this.brandKitService.getActiveBrandKit(organizationId)) ||
        this.getDefaultBrandKit();

      // 3. Prompt
      const prompt = this.buildEnhancedPrompt(generateDto, brandKit);

      // 4. Call AI
      const result = await this.openAiProvider.generateText(prompt);
      const { content, hashtags } = this.parseAiResponse(result);

      // 5. Costs & credits
      const tokens = result.usage.total_tokens;
      const { cost, credits } = this.calculateUsage(tokens);

      // 6. Save record
      const generation = await this.prisma.aiContentGeneration.create({
        data: {
          organizationId,
          userId,
          platform: generateDto.platform,
          contentType: generateDto.contentType,
          topic: generateDto.topic,
          tone: generateDto.tone,
          creditsUsed: credits,
          prompt,
          generatedText: content,
          hashtags,
          cost,
          provider: 'openai',
          model: result.model,
          brandKitId: brandKit.id !== 'default' ? brandKit.id : null,
        },
      });

      // 7. Track usage
      await this.aiUsageService.trackUsage({
        organizationId,
        userId,
        type: 'content_generation',
        tokensUsed: tokens,
        cost,
        metadata: {
          platform: generateDto.platform,
          contentType: generateDto.contentType,
          generationId: generation.id,
        },
      });

      this.logger.log(
        `✅ Generated content for org=${organizationId}, user=${userId} in ${
          Date.now() - start
        }ms`,
      );

      return generation;
    } catch (err) {
      this.logger.error(
        `❌ Content generation failed for org=${organizationId}, user=${userId}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Content generation failed: ${err.message}`,
      );
    }
  }

  async enhanceContent(
    content: string,
    options: {
      platform: Platform;
      tone: ToneType;
      brandKit: any;
      style?: string;
      organizationId: string;
      userId: string;
    },
    trackUsage = true,
  ) {
    const start = Date.now();

    try {
      const prompt = `
        Enhance the following content for ${options.platform}.
        
        TONE: ${options.tone}
        STYLE: ${options.style || 'general_enhancement'}
        
        BRAND GUIDELINES:
        ${this.buildBrandContext(options.brandKit)}

        CONTENT TO ENHANCE:
        """${content}"""

        Return response in JSON format:
        { "content": "...", "hashtags": ["#tag1", "#tag2"] }
      `;

      const result = await this.openAiProvider.generateText(prompt);
      const { content: enhancedContent, hashtags } =
        this.parseAiResponse(result);

      const tokens = result.usage.total_tokens;
      const { cost, credits } = this.calculateUsage(tokens);

      if (trackUsage) {
        await this.aiUsageService.trackUsage({
          organizationId: options.organizationId,
          userId: options.userId,
          type: 'content_enhancement',
          tokensUsed: tokens,
          cost,
          metadata: {
            style: options.style,
            platform: options.platform,
          },
        });
      }

      this.logger.log(
        `✨ Enhanced content for org=${options.organizationId} in ${
          Date.now() - start
        }ms`,
      );

      return { content: enhancedContent, hashtags, cost, credits };
    } catch (err) {
      this.logger.error(
        `❌ Content enhancement failed for org=${options.organizationId}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Content enhancement failed: ${err.message}`,
      );
    }
  }

  // ---------- Helpers ----------

  private getDefaultBrandKit() {
    return {
      id: 'default',
      name: 'Default Brand',
      brandVoice: 'Professional, engaging',
    };
  }

  private buildEnhancedPrompt(
    generateDto: GenerateContentDto,
    brandKit: any,
  ): string {
    const platformContext = this.getPlatformContext(generateDto.platform);
    const toneContext = this.getToneContext(generateDto.tone);
    const platformTips = this.getPlatformGuidelines(generateDto.platform);

    return `
      As a social media content creator for ${brandKit.name}, create ${generateDto.contentType.toLowerCase()} content.

      TOPIC: ${generateDto.topic}
      PLATFORM: ${platformContext}
      TONE: ${toneContext}
      
      BRAND GUIDELINES:
      ${this.buildBrandContext(brandKit)}

      CONTENT REQUIREMENTS:
      - Optimize for ${generateDto.platform} platform best practices
      - ${platformTips}
      - Use engaging hooks and calls-to-action
      - Include appropriate emojis and formatting
      - Ensure mobile-friendly readability
      - Apply ${generateDto.tone} tone consistently

      ${generateDto.customPrompt || 'Create engaging, on-brand content that resonates with our audience.'}

      Return response in JSON format: 
      { 
        "content": "...", 
        "hashtags": ["#tag1", "#tag2"],
        "engagement_hook": "optional hook phrase"
      }
    `;
  }

  private buildBrandContext(brandKit: any): string {
    const parts: string[] = [];
    if (brandKit.brandVoice) parts.push(`Brand voice: ${brandKit.brandVoice}`);
    if (brandKit.tone) parts.push(`Preferred tone: ${brandKit.tone}`);
    if (brandKit.guidelines?.keyMessaging)
      parts.push(
        `Key messaging: ${brandKit.guidelines.keyMessaging.join(', ')}`,
      );
    if (brandKit.guidelines?.targetAudience)
      parts.push(`Target audience: ${brandKit.guidelines.targetAudience}`);
    return parts.join('\n');
  }

  private parseAiResponse(result: any): {
    content: string;
    hashtags: string[];
  } {
    try {
      const parsed = JSON.parse(result.choices[0].message.content);
      return { content: parsed.content, hashtags: parsed.hashtags || [] };
    } catch {
      return { content: result.choices[0].message.content, hashtags: [] };
    }
  }

  private calculateUsage(tokens: number): { cost: number; credits: number } {
    const cost = (tokens / 1000) * 0.02; // GPT-4 pricing
    const credits = Math.ceil(tokens / 100);
    return { cost, credits };
  }

  private getPlatformContext(platform: Platform): string {
    const map = {
      INSTAGRAM: 'Instagram (visual-focused, casual, emoji-friendly)',
      FACEBOOK: 'Facebook (community-oriented, informative)',
      LINKEDIN: 'LinkedIn (professional, industry insights)',
      X: 'X/Twitter (concise, engaging, hashtag-driven)',
    };
    return map[platform] || platform;
  }

  private getPlatformGuidelines(platform: Platform): string {
    const tips: Record<string, string> = {
      INSTAGRAM:
        'Focus on visual storytelling, use emojis, create engagement hooks',
      FACEBOOK: 'Encourage discussions, ask questions, community-focused',
      X: 'Be concise, use threading, incorporate trends',
      LINKEDIN: 'Professional tone, value-driven, industry insights',
    };
    return tips[platform] || '';
  }

  private getToneContext(tone: ToneType): string {
    const map = {
      CASUAL: 'Casual and friendly',
      PROFESSIONAL: 'Professional and authoritative',
      EDUCATIONAL: 'Educational and informative',
      INSPIRATIONAL: 'Inspirational and motivational',
      WITTY: 'Witty and humorous',
    };
    return map[tone] || tone;
  }
}
