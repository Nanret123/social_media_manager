import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthResponse } from './dtos/AuthResponse.dto';
import { AuthService } from './auth.service';
import { GoogleUser } from './interface/GoogleUser.interface';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GoogleService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async validateGoogleUser(googleUser: any): Promise<any> {
    const { googleId, email, firstName, lastName, avatar } = googleUser;

    // Check if user exists by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId },
      include: { profile: true },
    });

    if (user) {
      // Update last login and return existing user
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
      return user;
    }

    // Check if user exists by email (for account linking)
    user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user) {
      // Link Google account to existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          emailVerified: true, // Google emails are pre-verified
          avatar: avatar || user.avatar,
          provider: user.provider === 'LOCAL' ? 'GOOGLE' : user.provider,
          lastLogin: new Date(),
        },
        include: { profile: true },
      });
      return user;
    }

    // Create new user with Google account
    user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          googleId,
          email,
          firstName,
          lastName,
          avatar,
          emailVerified: true, // Google emails are pre-verified
          provider: 'GOOGLE',
        },
        include: {
          profile: true,
        },
      });

      return newUser;
    });

    // Send welcome email for new Google users
    //await this.emailService.sendWelcomeEmail(user.email, user.firstName);

    return user;
  }

  async googleLogin(user: User, deviceInfo?: any): Promise<AuthResponse> {
    // Generate tokens for Google user
    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user,
      deviceInfo,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user?.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
    };
  }

  async linkGoogleAccount(
    userId: string,
    googleUser: GoogleUser,
  ): Promise<{ message: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check if Google account is already linked to another user
    const googleUserExists = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (googleUserExists && googleUserExists.id !== userId) {
      throw new BadRequestException(
        'Google account is already linked to another user',
      );
    }

    // Link Google account
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: googleUser.googleId,
        avatar: googleUser.avatar || existingUser.avatar,
        emailVerified: true,
      },
    });

    return { message: 'Google account successfully linked' };
  }

  async unlinkGoogleAccount(
    userId: string,
    password?: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user has a password, they can unlink without verification
    // If no password (Google-only user), they need to set a password first
    if (!user.password) {
      throw new BadRequestException(
        'Please set a password before unlinking your Google account',
      );
    }

    // If password provided, verify it
    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Password is incorrect');
      }
    }

    // Unlink Google account
    await this.prisma.user.update({
      where: { id: userId },
      data: { googleId: null },
    });

    return { message: 'Google account successfully unlinked' };
  }
}
