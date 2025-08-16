import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponse } from './dtos/AuthResponse.dto';
import { ForgotPassword } from './dtos/ForgotPassword.dto';
import { Login } from './dtos/Login.dto';
import { Register } from './dtos/Register.dto';
import { ResetPassword } from './dtos/ResetPassword.dto';
import { VerifyEmail } from './dtos/VerifyEmail.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshToken } from './dtos/RefreshToken.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: Register): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: Login, @Req() req: Request): Promise<AuthResponse> {
    const deviceInfo = {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    };
    return this.authService.login(dto, deviceInfo);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() dto: RefreshToken) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  async forgotPassword(@Body() dto: ForgotPassword) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password' })
  async resetPassword(@Body() dto: ResetPassword) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify user email' })
  async verifyEmail(@Query() dto: VerifyEmail) {
    return this.authService.verifyEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and revoke refresh token' })
  async logout(@Body() dto: RefreshToken, @CurrentUser() user: any) {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getProfile(@CurrentUser() user: any) {
    return { user };
  }

  // Google OAuth endpoints:
// GET  /api/v1/auth/google (initiates OAuth flow)
// GET  /api/v1/auth/google/callback (OAuth callback)
// POST /api/v1/auth/set-password (for OAuth users to set password)
}
