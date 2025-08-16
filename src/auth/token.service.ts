/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async generateAccessToken(payload: object): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  async generateRefreshToken(
    userId: string,
    deviceInfo?: any,
  ): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        deviceInfo: deviceInfo?.userAgent || null,
        ipAddress: deviceInfo?.ip || null,
        userAgent: deviceInfo?.userAgent || null,
      },
    });

    return token;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction([
      // Clean expired refresh tokens
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { isRevoked: true }],
        },
      }),
      // Clean expired email verification tokens
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { used: true }],
        },
      }),
      // Clean expired password reset tokens
      this.prisma.passwordResetToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { used: true }],
        },
      }),
    ]);
  }
}
