import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SafeUser } from 'src/auth/dtos/AuthResponse.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserFiltersDto } from './dtos/user-filters.dto';

@ApiTags('Users')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the currently authenticated user information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved',
    type: SafeUser,
  })
  async getCurrentUser(@Req() req): Promise<SafeUser> {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me/profile')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Updates first name, last name, and avatar for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated', type: SafeUser })
  async updateProfile(
    @Req() req,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change password',
    description:
      'Changes the password of the authenticated user after verifying current password.',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Req() req,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Deactivate account',
    description: 'Soft deletes the authenticated user account.',
  })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  async deactivateAccount(@Req() req): Promise<void> {
    return this.usersService.deactivateAccount(req.user.id);
  }

  @Get('organization/:organizationId')
  @ApiOperation({
    summary: 'List users by organization',
    description:
      'Returns paginated list of users for a given organization with optional search and role filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated users retrieved',
    schema: {
      example: {
        users: [
          {
            id: 'uuid',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatar: null,
            role: 'ANALYST',
            isEmailVerified: true,
            lastActiveAt: '2025-09-25T10:00:00.000Z',
            createdAt: '2025-09-25T09:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      },
    },
  })
  async getUsersByOrganization(
    @Param('organizationId') organizationId: string,
    @Query() filters: UserFiltersDto,
  ) {
    return this.usersService.getUsersByOrganization(organizationId, filters);
  }
}
