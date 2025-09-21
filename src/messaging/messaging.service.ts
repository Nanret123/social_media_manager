import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MessagingPlatform, MessageStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";


interface ProcessMessageEvent {
  platform: MessagingPlatform;
  messageData: {
    id: string;
    from: string;
    text: string;
    timestamp: Date;
    threadId?: string;
    mediaUrls?: string[];
  };
  socialAccountId: string;
  organizationId: string;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process incoming messages from webhooks/polling
   */
  async processIncomingMessage(event: ProcessMessageEvent): Promise<void> {
    try {
      // 1. Find or create conversation
      const conversation = await this.findOrCreateConversation(
        event.organizationId,
        event.platform,
        event.messageData.threadId || event.messageData.id,
        event.messageData.from
      );

      // 2. Create message
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalSender: event.messageData.from,
          content: event.messageData.text,
          mediaUrl: event.messageData.mediaUrls?.[0], // Store first media URL
          sentAt: event.messageData.timestamp,
          status: MessageStatus.UNREAD,
        },
      });

      // 3. Update conversation metrics
      await this.updateConversationMetrics(conversation.id);

      this.logger.log(`Processed message ${message.id} in conversation ${conversation.id}`);

      // 4. Emit event for notifications (if needed)
      this.emitNotificationEvent(conversation, message);

    } catch (error) {
      this.logger.error('Failed to process incoming message:', error);
      throw error;
    }
  }

  /**
   * Find or create conversation thread
   */
  private async findOrCreateConversation(
    organizationId: string,
    platform: MessagingPlatform,
    externalThreadId: string,
    externalUserId: string
  ) {
    return this.prisma.conversation.upsert({
      where: {
        organizationId_platform_externalId: {
          organizationId,
          platform,
          externalId: externalThreadId,
        },
      },
      update: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        externalUserId: externalUserId,
      },
      create: {
        organizationId,
        platform,
        externalId: externalThreadId,
        externalUserId: externalUserId,
        lastMessageAt: new Date(),
        lastMessagePreview: 'New conversation started',
      },
    });
  }

  /**
   * Update conversation unread count and last message preview
   */
  private async updateConversationMetrics(conversationId: string) {
    const messageCount = await this.prisma.message.count({
      where: { conversationId, status: MessageStatus.UNREAD },
    });

    const lastMessage = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      select: { content: true },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: messageCount,
        lastMessagePreview: lastMessage?.content?.substring(0, 100) || 'New message',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Emit event for notifications module
   */
  private emitNotificationEvent(conversation: any, message: any) {
    this.eventEmitter.emit('inbox.message.received', {
      conversationId: conversation.id,
      organizationId: conversation.organizationId,
      messageId: message.id,
      sender: message.externalSender,
      preview: message.content?.substring(0, 50),
      platform: conversation.platform,
    });
  }

  /**
   * Get conversations for organization
   */
  async getConversations(organizationId: string, filters?: any) {
    return this.prisma.conversation.findMany({
      where: { organizationId, ...filters },
      include: {
        messages: {
          take: 1,
          orderBy: { sentAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  /**
   * Get messages in a conversation
   */
  async getConversationMessages(conversationId: string, organizationId: string) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        conversation: { organizationId },
      },
      orderBy: { sentAt: 'asc' },
    });
  }

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string, organizationId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        conversation: { organizationId },
        status: MessageStatus.UNREAD,
      },
      data: { status: MessageStatus.READ },
    });

    await this.updateConversationMetrics(conversationId);
  }

  /**
   * Send reply to conversation
   */
  async sendReply(
    conversationId: string,
    organizationId: string,
    content: string,
    userId: string
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        sentAt: new Date(),
        status: MessageStatus.DELIVERED,
      },
    });

    await this.updateConversationMetrics(conversationId);

    // Emit event for outbound message processing
    this.eventEmitter.emit('inbox.message.sent', {
      conversationId,
      messageId: message.id,
      content,
      platform: conversation.platform,
      externalThreadId: conversation.externalId,
    });

    return message;
  }
}