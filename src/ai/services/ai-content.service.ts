import { Injectable, Logger } from '@nestjs/common';
import { Platform, ToneType } from '@prisma/client';
import { BrandKitService } from 'src/brand-kit/brand-kit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateContentDto } from '../dtos/generate-content.dto';

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandKitService: BrandKitService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly aiUsageService: AiUsageService,
  ) {}

  async generateContent(
    organizationId: string,
    userId: string,
    generateDto: GenerateContentDto,
  ) {
    const startTime = Date.now();

    try {
      // 1. Get brand kit for context
      const brandKit = (await this.brandKitService.getActiveBrandKit(
        organizationId,
      )) || {
        id: 'default',
        name: 'Default Brand',
        brandVoice: 'Professional, engaging',
      };
      // 2. Build enhanced prompt with brand context
      const prompt = this.buildPrompt(generateDto, brandKit);

      // 3. Call AI provider
      const result = await this.openAiProvider.generateText(prompt);

      // 4. Parse and format response
      const { content, hashtags } = this.parseAiResponse(result);

      // 5. Calculate cost and credits
      const cost = this.calculateCost(result.usage.total_tokens);
      const creditsUsed = this.calculateCredits(result.usage.total_tokens);

      // 6. Save generation record
      const generation = await this.prisma.aiContentGeneration.create({
        data: {
          organizationId,
          userId,
          platform: generateDto.platform,
          contentType: generateDto.contentType,
          topic: generateDto.topic,
          tone: generateDto.tone,
          creditsUsed,
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
        tokensUsed: result.usage.total_tokens,
        cost,
        metadata: {
          platform: generateDto.platform,
          contentType: generateDto.contentType,
          generationId: generation.id,
        },
      });

      this.logger.log(
        `Content generated in ${Date.now() - startTime}ms for org ${organizationId}`,
      );

      return generation;
    } catch (error) {
      this.logger.error('AI content generation failed:', error);
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

 private buildPrompt(generateDto: GenerateContentDto, brandKit: any): string {
  const platformContext = this.getPlatformContext(generateDto.platform);
  const toneContext = this.getToneContext(generateDto.tone);
  
  const brandContext = this.buildBrandContext(brandKit);

  return `
    As a social media content creator for ${brandKit.name}, create ${generateDto.contentType.toLowerCase()} content.

    TOPIC: ${generateDto.topic}
    PLATFORM: ${platformContext}
    TONE: ${toneContext}
    
    BRAND GUIDELINES:
    ${brandContext}

    ${generateDto.customPrompt || 'Create engaging, on-brand content that resonates with our audience.'}

    Include relevant hashtags and emojis where appropriate.
    Return response in JSON format: { "content": "...", "hashtags": ["#tag1", "#tag2"] }
  `;
}

private buildBrandContext(brandKit: any): string {
  const contextParts: string[] = [];
  
  if (brandKit.brandVoice) {
    contextParts.push(`Brand voice: ${brandKit.brandVoice}`);
  }
  
  if (brandKit.tone) {
    contextParts.push(`Preferred tone: ${brandKit.tone}`);
  }
  
  if (brandKit.guidelines?.keyMessaging) {
    contextParts.push(`Key messaging: ${brandKit.guidelines.keyMessaging.join(', ')}`);
  }
  
  if (brandKit.guidelines?.targetAudience) {
    contextParts.push(`Target audience: ${brandKit.guidelines.targetAudience}`);
  }
  
  return contextParts.join('\n');
}

  private parseAiResponse(result: any): {
    content: string;
    hashtags: string[];
  } {
    try {
      const parsed = JSON.parse(result.choices[0].message.content);
      return {
        content: parsed.content,
        hashtags: parsed.hashtags || [],
      };
    } catch (error) {
      // Fallback if AI doesn't return JSON
      return {
        content: result.choices[0].message.content,
        hashtags: [],
      };
    }
  }

  private calculateCost(tokens: number): number {
    // $0.02 per 1K tokens for GPT-4
    return (tokens / 1000) * 0.02;
  }

  private calculateCredits(tokens: number): number {
    // 1 credit = 100 tokens
    return Math.ceil(tokens / 100);
  }

  private getPlatformContext(platform: Platform): string {
    const contexts = {
      INSTAGRAM: 'Instagram (visual-focused, casual, emoji-friendly)',
      FACEBOOK: 'Facebook (community-oriented, informative)',
      LINKEDIN: 'LinkedIn (professional, industry insights)',
      X: 'X/Twitter (concise, engaging, hashtag-driven)',
    };
    return contexts[platform] || platform;
  }

  private getToneContext(tone: ToneType): string {
    const tones = {
      CASUAL: 'Casual and friendly',
      PROFESSIONAL: 'Professional and authoritative',
      EDUCATIONAL: 'Educational and informative',
      INSPIRATIONAL: 'Inspirational and motivational',
      WITTY: 'Witty and humorous',
    };
    return tones[tone] || tone;
  }
}
