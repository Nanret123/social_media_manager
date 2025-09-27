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
import cuid from 'cuid';

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandKitService: BrandKitService,
    private readonly stableDiffusionProvider: StableDiffusionProvider,
    private readonly aiUsageService: AiUsageService,
    private readonly cloudinary: CloudinaryService,
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
      // 1. Get active brand kit
      const brandKit =
        await this.brandKitService.getActiveBrandKit(organizationId);

      // 2. Build branded prompt
      const prompt = this.buildBrandedPrompt(dto.prompt, brandKit);

      // 3. Generate image via provider
      const result = await this.stableDiffusionProvider.generateImage({
        prompt,
        style: dto.style || 'photorealistic',
        aspectRatio: dto.aspectRatio || '1:1',
      });

      // 4. Upload to Cloudinary
      const publicId = `ai-images/${generationId}`;
      const uploaded = await this.cloudinary.uploadFromUrl(
        result.imageUrl,
        publicId,
      );

      // 5. Save generation record
      const generation = await this.prisma.aiImageGeneration.create({
        data: {
          id: generationId,
          organizationId,
          userId,
          prompt: dto.prompt,
          revisedPrompt: prompt,
          creditsUsed: 5, // match PLATFORM_RATE_LIMITS.AI.image_generation if needed
          cost: 0.01,
          imageUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
          provider: 'replicate',
          model: result.model,
          brandKitId: brandKit.id !== 'default' ? brandKit.id : null,
          status: 'PENDING',
        },
      });

      // 6. Track usage
      await this.aiUsageService.trackUsage({
        organizationId,
        userId,
        type: 'image_generation',
        tokensUsed: 0,
        cost: 0.01,
        metadata: { generationId, model: result.model },
      });

      this.logger.log(
        `AI image generated in ${Date.now() - startTime}ms for org ${organizationId} by user ${userId}`,
      );

      return generation;
    } catch (error) {
      this.logger.error('AI image generation failed', error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Approve AI-generated image and save as media
   */
  async approveImage(generationId: string, orgId: string, userId: string) {
    const generation = await this.prisma.aiImageGeneration.findUnique({
      where: { id: generationId },
    });
    if (!generation || generation.organizationId !== orgId) {
      throw new NotFoundException('Image generation not found');
    }
    if (generation.status === 'APPROVED') {
      throw new BadRequestException('Image already approved');
    }

    const [media] = await this.prisma.$transaction([
      this.prisma.mediaFile.create({
        data: {
          userId,
          organizationId: orgId,
          url: generation.imageUrl,
          publicId: generation.publicId,
          filename: `ai-${generationId}.jpg`,
          originalName: 'AI Generated Image',
          mimeType: 'image/jpeg',
          size: 0,
          aiGenerationId: generationId,
          aiGenerationContext: {
            prompt: generation.prompt,
            revisedPrompt: generation.revisedPrompt,
            model: generation.model,
          },
        },
      }),
      this.prisma.aiImageGeneration.update({
        where: { id: generationId },
        data: { status: 'APPROVED' },
      }),
    ]);

    return media;
  }

  /**
   * Reject AI-generated image and delete from Cloudinary + DB
   */
  async rejectImage(generationId: string, orgId: string) {
    const generation = await this.prisma.aiImageGeneration.findUnique({
      where: { id: generationId },
    });
    if (!generation || generation.organizationId !== orgId) {
      throw new NotFoundException('Image generation not found');
    }

    await this.cloudinary.deleteImage(generation.publicId);
    await this.prisma.aiImageGeneration.delete({ where: { id: generationId } });
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
}
