import { Module } from '@nestjs/common';
import { ContentTemplatesService } from './templates.service';
import { ContentTemplatesController } from './templates.controller';
import { AiModule } from 'src/ai/ai.module';
import { BrandKitModule } from 'src/brand-kit/brand-kit.module';

@Module({
  imports: [AiModule, BrandKitModule],
  controllers: [ContentTemplatesController],
  providers: [ContentTemplatesService ],
})
export class TemplatesModule {}
