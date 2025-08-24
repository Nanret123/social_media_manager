import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';
import { AuthResponse } from './dtos/AuthResponse.dto';
import { ForgotPassword } from './dtos/ForgotPassword.dto';
import { Login } from './dtos/Login.dto';
import { Register } from './dtos/Register.dto';
import { ResetPassword } from './dtos/ResetPassword.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponse })
  async register(@Body() registerDto: Register) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponse })
  async login(@Body() loginDto: Login, @Request() req) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Redirect to Google login
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with tokens' })
  async googleCallback(@Request() req, @Response() res) {
    const authResponse = await this.authService.googleLogin(req.user);

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const redirectUrl = `${frontendUrl}/auth/success?token=${authResponse.tokens.accessToken}&refresh=${authResponse.tokens.refreshToken}`;

    res.redirect(redirectUrl);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New tokens issued', type: AuthResponse })
  async refreshTokens(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.logout(body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link has been sent',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPassword) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() resetPasswordDto: ResetPassword) {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns user profile',
    schema: {
      example: {
        id: 'a3f6c2e7-5b0a-42d9-9c9c-7c6a8b9f1234',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        isEmailVerified: true,
      },
    },
  })
  async getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
