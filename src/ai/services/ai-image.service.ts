import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { GenerateImageDto } from '../dtos/generate-image.dto';
import { MediaService } from 'src/media/media.service';
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
    private readonly mediaService: MediaService,
  ) {}

   async generateImage(
    organizationId: string,
    userId: string,
    generateDto: GenerateImageDto,
  ) {
    const startTime = Date.now();
    const generationId = cuid();

    try {
      // 1. Get brand kit
      const brandKit = await this.brandKitService.getActiveBrandKit(organizationId);

      // 2. Build branded prompt
      const brandedPrompt = this.buildBrandedPrompt(generateDto.prompt, brandKit);

      // 3. Generate via Replicate
      const result = await this.stableDiffusionProvider.generateImage({
        prompt: brandedPrompt,
        style: 'photorealistic', // or another default/style from brandKit
        aspectRatio: '1:1', // or another default/aspect ratio from brandKit
      });

      // 4. Upload result directly to Cloudinary (permanent, not temp)
      const publicId = `ai-images/${generationId}`;
      const uploaded = await this.cloudinary.uploadFromUrl(result.imageUrl, publicId);

      // 5. Save generation record
      const generation = await this.prisma.aiImageGeneration.create({
        data: {
          id: generationId,
          organizationId,
          userId,
          prompt: generateDto.prompt,
          revisedPrompt: brandedPrompt,
          creditsUsed: 5,
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
        metadata: { generationId: generation.id, model: result.model },
      });

      this.logger.log(`Image generated in ${Date.now() - startTime}ms for org ${organizationId}`);

      return generation;
    } catch (error) {
      this.logger.error('AI image generation failed:', error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

async approveImage(generationId: string, orgId: string, userId: string) {
  // 1. Fetch and validate
  const generation = await this.prisma.aiImageGeneration.findUnique({ where: { id: generationId }});
  if (!generation || generation.organizationId !== orgId) {
    throw new NotFoundException('Image generation not found');
  }
  if (generation.status === 'APPROVED') {
    throw new BadRequestException('Already approved');
  }

  // 2. Transaction: create media + mark generation APPROVED
  const [media] = await this.prisma.$transaction([
    // Ensure saveGeneratedMedia returns a PrismaPromise, not a regular Promise
    this.prisma.mediaFile.create({
      data: {
        userId,
        organizationId: orgId,
        url: generation.imageUrl,
        publicId: generation.publicId,
        filename: `ai-${generationId}.jpg`,
        originalName: `AI Generated Image`,
        mimeType: 'image/jpeg',
        size: 0, // optionally call cloudinary.api.resource(publicId) to get size/dimensions
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

  async rejectImage(generationId: string, orgId: string) {
    // 1. Verify generation
    const generation = await this.prisma.aiImageGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation || generation.organizationId !== orgId) {
      throw new NotFoundException('Image generation not found');
    }

    // 2. Delete from Cloudinary
    await this.cloudinary.deleteImage(generation.publicId);

    // 3. Delete from DB
    await this.prisma.aiImageGeneration.delete({ where: { id: generationId } });
  }


  private buildBrandedPrompt(prompt: string, brandKit: any): string {
    const brandElements: string[] = [prompt];

    if (brandKit.colors) {
      const colors = Object.values(brandKit.colors).filter(Boolean);
      if (colors.length > 0) {
        brandElements.push(`brand colors: ${colors.join(', ')}`);
      }
    }

    if (brandKit.tone) {
      const styleMap = {
        PROFESSIONAL: 'clean, professional, corporate',
        CASUAL: 'casual, friendly, approachable',
        WITTY: 'playful, creative, humorous',
        EDUCATIONAL: 'informative, clear, educational',
      };
      brandElements.push(styleMap[brandKit.tone] || brandKit.tone.toLowerCase());
    }

    if (brandKit.logoUrl) {
      brandElements.push('incorporate brand identity subtly');
    }

    return brandElements.join(', ');
  }
}
