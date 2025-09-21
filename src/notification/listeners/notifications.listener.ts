// src/notifications/listeners/notifications.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType, NotificationPriority } from '@prisma/client';
import { NotificationService } from '../notification.service';

interface InboxMessageEvent {
  conversationId: string;
  organizationId: string;
  messageId: string;
  sender: string;
  preview: string;
  platform: string;
}

interface MentionEvent {
  userId: string;
  organizationId: string;
  postId: string;
  mentionedBy: string;
  context: string;
}

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notificationsService: NotificationService) {}

  @OnEvent('inbox.message.received')
  async handleNewMessage(event: InboxMessageEvent) {
    this.logger.debug(`Creating notification for new message: ${event.messageId}`);

    // In a real app, you'd determine which users should be notified
    // For now, notify all team members in the organization
    const usersToNotify = await this.getOrganizationUsers(event.organizationId);

    for (const user of usersToNotify) {
      await this.notificationsService.createNotification({
        userId: user.id,
        organizationId: event.organizationId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: 'New Message Received',
        message: `New message from ${event.sender}: ${event.preview}`,
        data: {
          conversationId: event.conversationId,
          messageId: event.messageId,
          platform: event.platform,
          sender: event.sender,
        },
        priority: NotificationPriority.NORMAL,
        messageId: event.messageId,
      });
    }
  }

  @OnEvent('user.mentioned')
  async handleUserMention(event: MentionEvent) {
    this.logger.debug(`Creating mention notification for user: ${event.userId}`);

    await this.notificationsService.createNotification({
      userId: event.userId,
      organizationId: event.organizationId,
      type: NotificationType.MENTION,
      title: 'You were mentioned',
      message: `${event.mentionedBy} mentioned you: ${event.context}`,
      data: {
        postId: event.postId,
        mentionedBy: event.mentionedBy,
        context: event.context,
      },
      priority: NotificationPriority.HIGH,
      postId: event.postId,
    });
  }

  @OnEvent('post.requires_approval')
  async handlePostApproval(event: { postId: string; organizationId: string; authorId: string }) {
    // Notify approvers about post needing approval
    const approvers = await this.getApprovers(event.organizationId);

    for (const approver of approvers) {
      await this.notificationsService.createNotification({
        userId: approver.id,
        organizationId: event.organizationId,
        type: NotificationType.POST_APPROVAL,
        title: 'Post requires approval',
        message: 'A new post is waiting for your approval',
        data: { postId: event.postId, authorId: event.authorId },
        priority: NotificationPriority.NORMAL,
        postId: event.postId,
      });
    }
  }

  private async getOrganizationUsers(organizationId: string): Promise<{ id: string }[]> {
    // Implement logic to get users in organization
    // This is a placeholder - implement based on your user management
    return [{ id: 'user-1' }, { id: 'user-2' }];
  }

  private async getApprovers(organizationId: string): Promise<{ id: string }[]> {
    // Implement logic to get users with approval permissions
    return [{ id: 'approver-1' }];
  }
}