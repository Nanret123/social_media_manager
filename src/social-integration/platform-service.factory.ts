// src/social-integration/services/platform-service.factory.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import {
  PlatformService,
  PlatformUser,
} from './interfaces/platform-service.interface';
import { LinkedInService } from './platforms/linkedin.service';
import { MetaService } from './platforms/meta.service';
import { XService } from './platforms/x.service';

@Injectable()
export class PlatformServiceFactory {
  private readonly logger = new Logger(PlatformServiceFactory.name);
  private readonly platformServices: Map<Platform, PlatformService>;

  constructor(
    private readonly metaService: MetaService,
    private readonly xService: XService,
    private readonly linkedinService: LinkedInService,
  ) {
    this.platformServices = new Map();
    this.initializeServices();
  }

  private initializeServices(): void {
    // Map each platform to its respective service
    this.platformServices.set(Platform.INSTAGRAM, this.metaService);
    this.platformServices.set(Platform.FACEBOOK, this.metaService);
    this.platformServices.set(Platform.X, this.xService);
    this.platformServices.set(Platform.LINKEDIN, this.linkedinService);

    this.logger.log('Platform services initialized');
  }

  /**
   * Get the appropriate service for a given platform
   */
  getService(platform: Platform): PlatformService {
    const service = this.platformServices.get(platform);

    if (!service) {
      this.logger.error(
        `No service implementation found for platform: ${platform}`,
      );
      throw new NotFoundException(`Platform ${platform} is not supported`);
    }

    return service;
  }

  /**
   * Get all available platform services
   */
  getAllServices(): Map<Platform, PlatformService> {
    return new Map(this.platformServices);
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform: Platform): boolean {
    return this.platformServices.has(platform);
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms(): Platform[] {
    return Array.from(this.platformServices.keys());
  }

  /**
   * Get required scopes for a platform
   */
  getScopesForPlatform(platform: Platform): string[] {
    const service = this.getService(platform);
    return service.getRequiredScopes();
  }

  /**
   * Validate credentials for a platform
   */
  async validateCredentials(
    platform: Platform,
    accessToken: string,
  ): Promise<boolean> {
    const service = this.getService(platform);
    return service.validateCredentials(accessToken);
  }

  /**
   * Get user profile for a platform
   */
  async getUserProfile(
    platform: Platform,
    accessToken: string,
  ): Promise<PlatformUser> {
    const service = this.getService(platform);
    return service.getUserProfile(accessToken);
  }

  /**
   * Revoke token for a platform
   */
  async revokeToken(platform: Platform, accessToken: string): Promise<void> {
    const service = this.getService(platform);
    return service.revokeToken(accessToken);
  }
}
