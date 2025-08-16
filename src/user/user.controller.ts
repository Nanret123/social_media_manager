import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ChangePassword } from './dtos/ChangePassword.dto';
import { DeactivateAccount } from './dtos/DeactivateAccount';
import { UpdateEmail } from './dtos/UpdateEmail.dto';
import { UpdateProfile } from './dtos/UpdateProfile.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('user')
//@ApiBearerAuth() // adds lock icon for secured endpoints
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.userService.getUserProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfile) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePassword) {
    return this.userService.changePassword(user.id, dto);
  }

  @Post('change-email/request')
  @ApiOperation({ summary: 'Request email change' })
  async requestEmailChange(@CurrentUser() user: any, @Body() dto: UpdateEmail) {
    return this.userService.requestEmailChange(user.id, dto);
  }

  @Public()
  @Post('change-email/confirm')
  @ApiOperation({ summary: 'Confirm email change with token' })
  async confirmEmailChange(@Query('token') token: string) {
    return this.userService.confirmEmailChange(token);
  }

  @Post('deactivate')
  @ApiOperation({ summary: 'Deactivate account' })
  async deactivateAccount(
    @CurrentUser() user: any,
    @Body() dto: DeactivateAccount,
  ) {
    return this.userService.deactivateAccount(user.id, dto);
  }

  @Post('reactivate')
  @ApiOperation({ summary: 'Reactivate account' })
  async reactivateAccount(@CurrentUser() user: any) {
    return this.userService.reactivateAccount(user.id);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Delete account permanently' })
  async deleteAccount(
    @CurrentUser() user: any,
    @Body('password') password: string,
  ) {
    return this.userService.deleteAccount(user.id, password);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user stats' })
  async getUserStats(@CurrentUser() user: any) {
    return this.userService.getUserStats(user.id);
  }

  @Public()
  @Get('public/:userId')
  @ApiOperation({ summary: 'Get public profile by userId' })
  async getPublicProfile(@Param('userId') userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotifications(
    @CurrentUser() user: any,
    @Body() preferences: any,
  ) {
    return this.userService.updateNotificationPreferences(user.id, preferences);
  }
}
