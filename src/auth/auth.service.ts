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
import { GoogleService } from './google.service';

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private tokenService: TokenService,
    private googleService: GoogleService,
  ) {}

  async register(dto: Register): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

    // Create user and profile in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        include: {
          profile: true,
        },
      });

      return user;
    });

    // Generate email verification token
    await this.generateEmailVerificationToken(result.email, result.id);

    // Send verification email
    // await this.emailService.sendEmailVerification(
    //   result.email,
    //   result.firstName,
    //   verificationToken,
    // );

    // Generate auth tokens
    const { accessToken, refreshToken } = await this.generateTokens(result);

    return {
      accessToken,
      refreshToken,
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName ?? '',
        lastName: result.lastName ?? '',
        emailVerified: result.emailVerified,
      },
    };
  }

  async login(dto: Login, deviceInfo?: any): Promise<AuthResponse> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user,
      deviceInfo,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
    };
  }

  async refreshToken(
    refreshTokenString: string,
  ): Promise<{ accessToken: string }> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenString },
      include: { user: true },
    });

    if (
      !refreshToken ||
      refreshToken.isRevoked ||
      refreshToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate new access token
    const payload = {
      sub: refreshToken.user.id,
      email: refreshToken.user.email,
    };

    const accessToken = await this.tokenService.generateAccessToken(payload);

    return { accessToken };
  }

  async forgotPassword(dto: ForgotPassword): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Invalidate existing reset tokens
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

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

  private async generateEmailVerificationToken(
    email: string,
    userId: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        email,
        userId,
        expiresAt,
      },
    });

    return token;
  }
}
