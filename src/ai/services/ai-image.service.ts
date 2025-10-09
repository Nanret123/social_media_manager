import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { GenerateImageDto } from '../dtos/generate-image.dto';
import { BrandKitService } from 'src/brand-kit/brand-kit.service';
import { CloudinaryService } from 'src/media/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StableDiffusionProvider } from 'src/ai/providers/stable-diffusion.service';
import { HuggingFaceService } from '../providers/huggingface.provider';
import * as cuid from 'cuid';

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandKitService: BrandKitService,
    private readonly stableDiffusionProvider: StableDiffusionProvider,
    private readonly aiUsageService: AiUsageService,
    private readonly cloudinary: CloudinaryService,
    private readonly huggingFaceService: HuggingFaceService,
  ) {}

  /**
   * Generate an AI image based on a prompt
   */
  async generateImage(
    organizationId: string,
    userId: string,
    dto: GenerateImageDto,
  ) {
    const startTime = Date.now();
    const generationId = cuid();

    try {
      // 1️⃣ Get active brand kit
      const brandKit =
        await this.brandKitService.getActiveBrandKit(organizationId);

      // 2️⃣ Build branded prompt
      const prompt = this.buildBrandedPrompt(dto.prompt, brandKit);
      this.validatePromptSafety(prompt);

      // 3️⃣ Generate image via Hugging Face
      const model = dto.model ?? 'stabilityai/stable-diffusion-xl-base-1.0';
      const result = await this.huggingFaceService.generateImage(prompt, model);

      if (!result?.imageUrl) {
        throw new Error('Image generation failed — missing imageUrl');
      }

      // 4️⃣ Upload to Cloudinary
      const publicId = `ai-images/${generationId}`;
      const uploaded = await this.cloudinary.uploadFromUrl(
        result.imageUrl,
        publicId,
      );

      // 5️⃣ Save generation record
      const generation = await this.prisma.aiImageGeneration.create({
        data: {
          id: generationId,
          organizationId,
          userId,
          prompt: dto.prompt,
          revisedPrompt: prompt,
          creditsUsed: 5, // configurable
          cost: 0.01,
          imageUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
          provider: 'huggingface',
          model,
          brandKitId: brandKit.id !== 'default' ? brandKit.id : null,
        },
      });

      // 6️⃣ Save media file record
      await this.prisma.mediaFile.create({
        data: {
          userId,
          organizationId,
          url: generation.imageUrl,
          publicId: generation.publicId,
          filename: `ai-${generationId}.jpg`,
          originalName: 'AI Generated Image',
          mimeType: 'image/jpeg',
          size: 0,
          aiGenerationId: generationId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          aiGenerationContext: {
            prompt: generation.prompt,
            revisedPrompt: generation.revisedPrompt,
            model: generation.model,
          },
        },
      });

      // 7️⃣ Track usage
      await this.aiUsageService.trackUsage({
        organizationId,
        userId,
        type: 'image_generation',
        tokensUsed: 0,
        cost: 0.01,
        metadata: { generationId, model },
      });

      this.logger.log(
        `✅ AI image generated in ${Date.now() - startTime}ms for org ${organizationId} by user ${userId}`,
      );

      return generation;
    } catch (error) {
      this.logger.error('❌ AI image generation failed', error.stack || error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Delete AI-generated image from Cloudinary + DB
   */
  async deleteImage(generationId: string, orgId: string) {
    const generation = await this.prisma.aiImageGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation || generation.organizationId !== orgId) {
      throw new NotFoundException('Image generation not found');
    }

    try {
      // Delete from Cloudinary
      await this.cloudinary.deleteImage(generation.publicId);

      // Delete associated mediaFile
      await this.prisma.mediaFile.deleteMany({
        where: { aiGenerationId: generationId },
      });

      // Delete generation record
      await this.prisma.aiImageGeneration.delete({
        where: { id: generationId },
      });

      this.logger.log(`🗑️ Deleted AI image ${generationId} for org ${orgId}`);
    } catch (error) {
      this.logger.error('❌ Failed to delete AI image', error.stack || error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Add brand elements to prompt
   */
  private buildBrandedPrompt(prompt: string, brandKit: any): string {
    const elements: string[] = [prompt];

    if (brandKit.colors) {
      const colors = Object.values(brandKit.colors).filter(Boolean);
      if (colors.length) elements.push(`brand colors: ${colors.join(', ')}`);
    }

    if (brandKit.tone) {
      const toneMap: Record<string, string> = {
        PROFESSIONAL: 'clean, professional, corporate',
        CASUAL: 'casual, friendly, approachable',
        WITTY: 'playful, creative, humorous',
        EDUCATIONAL: 'informative, clear, educational',
      };
      elements.push(toneMap[brandKit.tone] || brandKit.tone.toLowerCase());
    }

    if (brandKit.logoUrl) elements.push('incorporate brand identity subtly');

    return elements.join(', ');
  }

  private validatePromptSafety(prompt: string) {
    const blockedTerms = [
      'nude',
      'naked',
      'explicit',
      'porn',
      'xxx',
      'violent',
      'explicit',
      'hate',
    ];
    const lowerPrompt = prompt.toLowerCase();

    if (blockedTerms.some((term) => lowerPrompt.includes(term))) {
      throw new BadRequestException('Prompt contains blocked content');
    }
  }
}
