import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetConversationsDto } from './dtos/get-conversations.dto';
import { MarkAsReadDto } from './dtos/mark-as-read.dto';
import { SendReplyDto } from './dtos/send-reply.dto';

@ApiTags('Inbox')
@Controller('inbox')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get(':organizationId/conversations')
  @ApiOperation({ summary: 'Get conversations for organization' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @Param('organizationId') organizationId: string,
    @Query() query: GetConversationsDto,
  ) {
    return this.messagingService.getConversations(organizationId, query);
  }

  @Get(':organizationId/conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getConversationMessages(
    @Param('organizationId') organizationId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagingService.getConversationMessages(
      conversationId,
      organizationId,
    );
  }

  @Post(':organizationId/conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark all messages in a conversation as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Param('organizationId') organizationId: string,
    @Body() dto: MarkAsReadDto,
  ) {
    return this.messagingService.markAsRead(dto.conversationId, organizationId);
  }

  @Post(':organizationId/conversations/:conversationId/reply')
  @ApiOperation({ summary: 'Send a reply to a conversation' })
  @ApiResponse({ status: 201, description: 'Reply sent successfully' })
  async sendReply(
    @Param('organizationId') organizationId: string,
    @Body() dto: SendReplyDto,
  ) {
    return this.messagingService.sendReply(
      dto.conversationId,
      organizationId,
      dto.content,
      dto.userId,
    );
  }
}
