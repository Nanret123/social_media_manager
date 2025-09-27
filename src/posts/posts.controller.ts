import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Delete,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { GetOrganizationPostsDto } from './dto/get-organization-posts.dto';
import { PostFilterDto } from './dto/post-filter.dto';

@ApiTags('Posts')
@ApiBearerAuth()
@Controller('organizations/:organizationId/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post in an organization' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  async createPost(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreatePostDto,
  ) {
    const userId = 'mock-user-id'; // Replace with `req.user.id` from auth
    return this.postsService.createPost(organizationId, userId, dto);
  }

  @Post(':postId/schedule')
  @ApiOperation({ summary: 'Schedule a post for future publishing' })
  async schedulePost(
    @Param('organizationId') organizationId: string,
    @Param('postId') postId: string,
    @Body() dto: SchedulePostDto,
  ) {
    return this.postsService.schedulePost(postId, organizationId, dto);
  }

  @Post(':postId/publish-now')
  @ApiOperation({ summary: 'Publish a post immediately' })
  async publishNow(
    @Param('organizationId') organizationId: string,
    @Param('postId') postId: string,
  ) {
    return this.postsService.publishNow(postId, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts for an organization with filters' })
  async getOrganizationPosts(
    @Param('organizationId') organizationId: string,
     @Query() query: PostFilterDto
  ) {
    return this.postsService.getOrganizationPosts(organizationId, query);
  }

  @Delete(':postId/schedule')
  @ApiOperation({ summary: 'Cancel a scheduled post' })
  async cancelScheduledPost(
    @Param('organizationId') organizationId: string,
    @Param('postId') postId: string,
  ) {
    return this.postsService.cancelScheduledPost(postId, organizationId);
  }
}
