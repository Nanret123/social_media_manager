import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.service';
import { AiContentService } from './services/ai-content.service';
import { AiImageService } from './services/ai-image.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiController } from './ai.controller';
import { StableDiffusionProvider } from './providers/stable-diffusion.service';
import { BrandKitModule } from 'src/brand-kit/brand-kit.module';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { MediaModule } from 'src/media/media.module';
import { HuggingFaceService} from './providers/huggingface.provider';


@Module({
  imports: [BrandKitModule, RateLimitModule, MediaModule],
  controllers: [AiController],
  providers: [AiContentService,
    AiImageService,
    AiUsageService,
    OpenAiProvider,
    StableDiffusionProvider,
    HuggingFaceService],
  exports: [AiContentService, AiImageService, AiUsageService],
})
export class AiModule {}
