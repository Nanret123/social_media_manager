import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserProfileResponse } from './dtos/UserProfileResponse.dto';
import { UpdateProfile } from './dtos/UpdateProfile.dto';
import { ChangePassword } from './dtos/ChangePassword.dto';
import { UpdateEmail } from './dtos/UpdateEmail.dto';
import { DeactivateAccount } from './dtos/DeactivateAccount';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
       select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        provider: true,
        emailVerified: true,
        accountStatus: true,
        profile: {
          select: {
            bio: true,
            subscriptionTier: true,
            subscriptionEndsAt: true,
            notifications: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

async updateProfile(
  userId: string,
  dto: UpdateProfile,
): Promise<UserProfileResponse> {
  const updatedUser = await this.prisma.user.update({
    where: { id: userId },
    data: {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.avatar && { avatar: dto.avatar }),

      profile: {
        upsert: {
          update: {
            ...(dto.bio && { bio: dto.bio }),
            ...(dto.notifications && { notifications: dto.notifications }),
          },
          create: {
            avatar: dto.avatar,
            bio: dto.bio,
            notifications: dto.notifications ?? {},
          },
        },
      },
    },
    include: { profile: true },
  });

  return this.formatUserProfile(updatedUser);
}


  async changePassword(
    userId: string,
    dto: ChangePassword,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(
      dto.newPassword,
      12,
    );

    // Update password and revoke all refresh tokens for security
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    return { message: 'Password successfully changed' };
  }

  async deactivateAccount(
    userId: string,
    dto: DeactivateAccount,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Deactivate account and revoke all tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'DEACTIVATED' },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    // TODO: Log deactivation reason if provided
    if (dto.reason) {
      console.log(`Account deactivated. Reason: ${dto.reason}`);
    }

    return { message: 'Account successfully deactivated' };
  }

  async reactivateAccount(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'ACTIVE' },
    });

    return { message: 'Account successfully reactivated' };
  }

  async deleteAccount(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Delete user (cascade will handle related records)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account successfully deleted' };
  }

  private formatUserProfile(user: any): UserProfileResponse{
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      profile: {
        avatar: user.profile?.avatar,
        bio: user.profile?.bio,
        subscriptionTier: user.profile?.subscriptionTier || 'FREE',
        subscriptionEndsAt: user.profile?.subscriptionEndsAt,
        notifications: user.profile?.notifications || {},
      },
    };
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile: {
          select: {
            avatar: true,
            bio: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.profile?.avatar,
      bio: user.profile?.bio,
    };
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // include: {
      //   socialAccounts: {
      //     where: { isActive: true },
      //     select: {
      //       platform: true,
      //       username: true,
      //       displayName: true,
      //       accountType: true,
      //     },
      //   },
      //   _count: {
      //     select: {
      //       socialAccounts: {
      //         where: { isActive: true },
      //       },
      //     },
      //   },
      // },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      // totalSocialAccounts: user._count.socialAccounts,
      // connectedPlatforms: user.socialAccounts.map(account => ({
      //   platform: account.platform,
      //   username: account.username,
      //   displayName: account.displayName,
      //   accountType: account.accountType,
      // })),
      memberSince: user.createdAt,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: any,
  ): Promise<{ message: string }> {
    await this.prisma.userProfile.upsert({
      where: { userId },
      update: { notifications: preferences },
      create: {
        userId,
        notifications: preferences,
      },
    });

    return { message: 'Notification preferences updated' };
  }

}
