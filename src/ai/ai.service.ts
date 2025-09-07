import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AspectRatio, GenerationType, Platform, UsageType } from '@prisma/client';
import {
  GeneratedContent,
  GeneratedImage,
} from './interfaces/ai.interface';
import OpenAI from 'openai';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaService } from 'src/media/media.service';
import { GenerateContentDto } from './dtos/generate-content.dto';
import { GenerateImageDto } from './dtos/generate-image.dto';

export class GenerateContentDto {
  organizationId: string;
  prompt: string; // The user's direct input
  platform: string; // 'instagram', 'twitter', etc.
}

export class GenerateImageDto {
  organizationId: string;
  prompt: string; // The user's direct input
}

export class GeneratedContent {
  id: string;
  text: string;
  hashtags: string[];
  cost: number;
}

export class GeneratedImage {
  id: string;
  url: string;
  cost: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  // Simplified, hardcoded pricing for MVP
  private readonly TEXT_COST_PER_CREDIT = 0.01; // Simplified cost per text gen
  private readonly IMAGE_COST_PER_CREDIT = 0.04; // Simplified cost per image gen

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private mediaService: MediaService, // Handles uploads to Cloudinary/S3
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  /**
   * MVP Content Generation - One method to rule them all.
   * Generates text based on a simple prompt and platform.
   */
  async generateContent(dto: GenerateContentDto, userId: string): Promise<GeneratedContent> {
    try {
      // 1. Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a social media expert. Generate engaging content for ${dto.platform}. Respond ONLY with the caption text.`,
          },
          { role: 'user', content: dto.prompt },
        ],
        max_tokens: 500,
      });

      const generatedText = completion.choices[0].message.content;
      
      // 2. (Optional) Simple hashtag generation - can be added later
      const hashtags = []; 

      // 3. Calculate fixed cost for MVP
      const cost = this.TEXT_COST_PER_CREDIT;

      // 4. Save to DB
      const aiContent = await this.prisma.aiContentGeneration.create({
        data: {
          organizationId: dto.organizationId,
          userId: userId,
          platform: dto.platform,
          prompt: dto.prompt,
          generatedText: generatedText,
          hashtags: hashtags,
          cost: cost,
        },
      });

      // 5. Track usage
      await this.prisma.aiUsage.create({
        data: {
          organizationId: dto.organizationId,
          userId: userId,
          type: 'TEXT_GENERATION',
          creditsUsed: 1,
        },
      });

      return {
        id: aiContent.id,
        text: generatedText,
        hashtags: hashtags,
        cost: cost,
      };
    } catch (error) {
      this.logger.error('Content generation failed', error);
      throw new HttpException('Failed to generate content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * MVP Image Generation
   */
  async generateImage(dto: GenerateImageDto, userId: string): Promise<GeneratedImage> {
    try {
      // 1. Call DALL-E
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: dto.prompt,
        n: 1,
        size: '1024x1024', // Standard size for MVP
      });

      const imageUrl = response.data[0].url;

      // 2. Upload to permanent storage (CRITICAL for MVP - OpenAI URLs are temporary)
      const uploadedImage = await this.mediaService.uploadImageFromUrl(imageUrl, {
        folder: `ai-images/${dto.organizationId}`,
      });

      // 3. Calculate fixed cost
      const cost = this.IMAGE_COST_PER_CREDIT;

      // 4. Save to DB
      const aiImage = await this.prisma.aiImageGeneration.create({
        data: {
          organizationId: dto.organizationId,
          userId: userId,
          prompt: dto.prompt,
          imageUrl: uploadedImage.url,
          cost: cost,
        },
      });

      // 5. Track usage
      await this.prisma.aiUsage.create({
        data: {
          organizationId: dto.organizationId,
          userId: userId,
          type: 'IMAGE_GENERATION',
          creditsUsed: 1, // Could make this 2 or more to reflect higher cost
        },
      });

      return {
        id: aiImage.id,
        url: uploadedImage.url,
        cost: cost,
      };
    } catch (error) {
      this.logger.error('Image generation failed', error);
      throw new HttpException('Failed to generate image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- MVP HISTORY METHODS ---

  async getContentHistory(organizationId: string) {
    return this.prisma.aiContentGeneration.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Simple limit for MVP
    });
  }

  async getImageHistory(organizationId: string) {
    return this.prisma.aiImageGeneration.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Fewer images than text posts
    });
  }
}