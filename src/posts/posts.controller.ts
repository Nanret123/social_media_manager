import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePost } from './dto/create-post.dto';
import { UpdatePost } from './dto/update-post.dto';

@ApiTags('Posts')
@Controller('api/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  create(@Req() req: any, @Body() createPostDto: CreatePost) {
    return this.postsService.createPost(req.user.id, createPostDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts for the current user' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by post status' })
  findAll(@Req() req: any, @Query() filters: any) {
    return this.postsService.getUserPosts(req.user.id, filters);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a post immediately' })
  @ApiParam({ name: 'id', description: 'Post ID to publish' })
  publishNow(@Req() req: any, @Param('id') id: string) {
    return this.postsService.publishPostNow(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', description: 'Post ID to update' })
  update(@Req() req: any, @Param('id') id: string, @Body() updatePostDto: UpdatePost) {
    return this.postsService.updatePost(req.user.id, id, updatePostDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', description: 'Post ID to delete' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.postsService.deletePost(req.user.id, id);
  }
}
