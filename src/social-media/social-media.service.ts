import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SocialMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // private readonly encryption: EncryptionService,
    // private readonly platformFactory: PlatformFactory,
  ) {}

   async getConnectedAccounts(userId: string) {
    const accounts = await this.prisma.socialMediaAccount.findMany({
      where: { ownerId: userId, isActive: true },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        profileUrl: true,
        accountType: true,
        connectionStatus: true,
        lastSuccessfulSync: true,
        lastFailedSync: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return accounts;
  }
}
