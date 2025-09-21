import { Module } from '@nestjs/common';
import { SocialIntegrationService } from './social-integration.service';
import { SocialIntegrationController } from './social-integration.controller';
import { SocialAccountModule } from 'src/social-account/social-account.module';
import { HttpModule } from '@nestjs/axios';
import { CryptoService } from 'src/shared/encryption/crypto.service';
import { PlatformServiceFactory } from './platform-service.factory';
import { LinkedInService } from './platforms/linkedin.service';
import { MetaService } from './platforms/meta.service';
import { XService } from './platforms/x.service';

@Module({
  imports: [
    SocialAccountModule,
    HttpModule, // For making HTTP requests
  ],
  controllers: [SocialIntegrationController],
  providers: [
    SocialIntegrationService,
    PlatformServiceFactory,
    MetaService,
    XService,
    LinkedInService,
    CryptoService,
    PlatformServiceFactory,
    MetaService,
    XService,
    LinkedInService,
    CryptoService,
  ],
})
export class SocialIntegrationModule {}
