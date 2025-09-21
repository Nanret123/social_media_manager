// src/notifications/services/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, NotificationPriority } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface CreateNotificationDto {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority?: NotificationPriority;
  messageId?: string;
  postId?: string;
  expiresAt?: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new notification
   */
  async createNotification(createDto: CreateNotificationDto) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: createDto.userId,
          organizationId: createDto.organizationId,
          type: createDto.type,
          title: createDto.title,
          content: createDto.message,
          data: createDto.data,
          priority: createDto.priority || NotificationPriority.NORMAL,
          messageId: createDto.messageId,
          postId: createDto.postId,
          expiresAt: createDto.expiresAt,
        },
      });

      this.logger.log(`Created notification ${notification.id} for user ${createDto.userId}`);

      // Emit event for real-time delivery
      this.eventEmitter.emit('notification.created', notification);

      return notification;

    } catch (error) {
      this.logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, organizationId: string, options?: { unreadOnly?: boolean }) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        organizationId,
        read: options?.unreadOnly ? false : undefined,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit for performance
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string, organizationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId,
        read: false,
      },
      data: { read: true },
    });
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    const result = await this.prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    
    this.logger.log(`Cleaned up ${result.count} expired notifications`);
    return result.count;
  }
}