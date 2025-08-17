import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthResponse } from './dtos/AuthResponse.dto';
import { Register } from './dtos/Register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { TokenService } from './token.service';
import { Login } from './dtos/Login.dto';
import { ForgotPassword } from './dtos/ForgotPassword.dto';
import { ResetPassword } from './dtos/ResetPassword.dto';
import { AuthProvider, SubscriptionTier } from '@prisma/client';
import { GoogleProfile } from './interfaces/GoogleProfile.interface';

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private tokenService: TokenService
  ) {}

  async register(dto: Register, req?: any): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Extract device info
    const deviceInfo = this.extractDeviceInfo(req);

    // Create user and profile in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatar: dto.avatar,
          provider: AuthProvider.LOCAL,
          profile: {
            create: {
              avatar: dto.avatar,
              subscriptionTier: SubscriptionTier.FREE,
            },
          },
        },
        include: { profile: true },
      });

      // Generate email verification token
      const emailToken = await this.generateEmailVerificationToken(user.email, user.id, tx);
      
      // Send verification email
      // await this.emailService.sendEmailVerification(user.email, user.firstName, emailToken);

      return user;
    });

    // Generate tokens
    const tokens = await this.generateTokens(result, deviceInfo);

    return this.formatLoginResponse(result, tokens);
  }

async login(dto: Login, req?: any): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || user.provider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please use Google Sign-In for this account');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    const deviceInfo = this.extractDeviceInfo(req);
    const tokens = await this.generateTokens(user, deviceInfo);

    return this.formatLoginResponse(user, tokens);
  }

  // ===== GOOGLE OAUTH =====
  async googleAuth(profile: GoogleProfile, req?: any): Promise<AuthResponse> {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.id },
          { email: profile.email, provider: AuthProvider.GOOGLE },
        ],
      },
      include: { profile: true },
    });

    const deviceInfo = this.extractDeviceInfo(req);

    if (!user) {
      // Create new user
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: profile.email,
            googleId: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatar: profile.picture,
            provider: AuthProvider.GOOGLE,
            emailVerified: true, // Google emails are pre-verified
            profile: {
              create: {
                avatar: profile.picture,
                subscriptionTier: SubscriptionTier.FREE,
              },
            },
          },
          include: { profile: true },
        });

        return newUser;
      });
    } else {
      // Update existing user info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatar: profile.picture,
          emailVerified: true,
        },
        include: { profile: true },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    const tokens = await this.generateTokens(user, deviceInfo);
    return this.formatLoginResponse(user, tokens);
  }

    // ===== TOKEN MANAGEMENT =====
  async refreshToken(oldRefreshToken: string, req?: any): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    const deviceInfo = this.extractDeviceInfo(req);
    const tokens = await this.generateTokens(tokenRecord.user, deviceInfo);

    return tokens;
  }


  async forgotPassword(dto: ForgotPassword): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return success to prevent email enumeration
    if (!user || user.provider !== AuthProvider.LOCAL) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        email: dto.email,
        userId: user.id,
        expiresAt,
      },
    });

    // Send reset email
    // await this.emailService.sendPasswordReset(
    //   user.email,
    //   user.firstName,
    //   resetToken,
    // );

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPassword): Promise<{ message: string }> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, this.saltRounds);

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Revoke all existing refresh tokens for security
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { isRevoked: true },
      }),
    ]);

    return { message: 'Password successfully reset' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const emailToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!emailToken || emailToken.used || emailToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Mark email as verified
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: emailToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: emailToken.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Email successfully verified' };
  }

  async logout(
    userId: string,
    refreshToken: string,
  ): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
      },
      data: { isRevoked: true },
    });

    return { message: 'Successfully logged out' };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async generateTokens(user: { id: string; email: string }, deviceInfo?: any) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(user.id, deviceInfo),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateEmailVerificationToken(email: string, userId?: string, tx?: any): Promise<string> {
    const prisma = tx || this.prisma;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        token,
        email,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  private parseUserAgent(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';
    
    // Simple device detection - a library like 'ua-parser-js'
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  private extractDeviceInfo(req?: any) {
    if (!req) return null;

    return {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      device: this.parseUserAgent(req.get('user-agent')),
    };
  }

   private formatLoginResponse(user: any, tokens: any): AuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        provider: user.provider,
        emailVerified: user.emailVerified,
      },
      tokens,
    };
  }
}
