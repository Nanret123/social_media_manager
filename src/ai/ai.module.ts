import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.service';
import { AiContentService } from './services/ai-content.service';
import { AiImageService } from './services/ai-image.service';
import { AiUsageService } from './services/ai-usage.service';


@Module({
  controllers: [AiController],
  providers: [AiContentService,
    AiImageService,
    AiUsageService,
    OpenAiProvider,
    ReplicateProvider,
    PrismaService,],
})
export class AiModule {}
