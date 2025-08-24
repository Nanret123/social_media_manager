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
import { AuthProvider, User } from '@prisma/client';
import { GoogleProfile } from './interfaces/google-profile.interface';
import { MailService } from 'src/mail/mail.service';
import { Login } from './dtos/Login.dto';
import { ForgotPassword } from './dtos/ForgotPassword.dto';
import { ResetPassword } from './dtos/ResetPassword.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {

   constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: MailService,
  ) {}

 async register(registerDto: Register): Promise<AuthResponse> {
    const { email, password, firstName, lastName, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'ANALYST',
        emailVerificationToken,
        provider: AuthProvider.LOCAL,
      }
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(email, emailVerificationToken);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user,
      tokens,
    };
  }

  async login(loginDto: Login): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email, provider: AuthProvider.LOCAL },
    });

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateGoogleUser(profile: GoogleProfile): Promise<User> {
    const email = profile.emails[0].value;
    
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update user if they signed up with local auth first
      if (user.provider === AuthProvider.LOCAL) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.id,
            isEmailVerified: true, // Google emails are pre-verified
          },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          googleId: profile.id,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          provider: AuthProvider.GOOGLE,
          isEmailVerified: true,
          role: 'ANALYST',
        },
      });
    }

    return user;
  }

  async googleLogin(user: User): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in database
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user);

      // Remove old refresh token
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPassword): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email, provider: AuthProvider.LOCAL },
    });

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    await this.emailService.sendPasswordResetEmail(email, resetToken);
  }

  async resetPassword(resetPasswordDto: ResetPassword): Promise<void> {
    const { token, password } = resetPasswordDto;

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
