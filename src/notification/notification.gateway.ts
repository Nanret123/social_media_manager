import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  userId: string;
  organizationId: string;
}
interface AuthenticatedSocket extends Socket {
  userId: string;
  organizationId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, Set<Socket>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        throw new Error('Missing token');
      }

      const payload = this.jwtService.verify(token.toString());
      client.userId = payload.sub;
      client.organizationId = payload.organizationId;

      this.addClient(client.userId, client);
      
      // User joins their personal room and organization room
      client.join(`user:${client.userId}`);
      client.join(`org:${client.organizationId}`);

      this.logger.log(
        `Notification client connected: user=${client.userId}, org=${client.organizationId}`,
      );

      client.emit('connected', { 
        message: 'Connected to notification service',
        userId: client.userId 
      });
    } catch (error) {
      this.logger.warn(`Notification connection rejected: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.userId) {
      this.removeClient(client.userId, client);
      this.logger.log(`Notification client disconnected: ${client.userId}`);
    }
  }

  /**
   * Notify a specific user
   */
  notifyUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Notify all users in an organization
   */
  notifyOrganization(organizationId: string, event: string, data: any): void {
    this.server.to(`org:${organizationId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Update user's unread notification count
   */
  updateUnreadCount(userId: string, unreadCount: number): void {
    this.notifyUser(userId, 'notifications:unread_count', { unreadCount });
  }

  /**
   * Mark notifications as read (real-time update)
   */
  markNotificationsRead(userId: string, notificationIds: string[]): void {
    this.notifyUser(userId, 'notifications:marked_read', { notificationIds });
  }

  @OnEvent('notification.created')
  handleNotificationCreated(notification: any) {
    this.notifyUser(notification.userId, 'notification:new', {
      notification,
    });

    this.logger.log(
      `Notification ${notification.id} pushed to user ${notification.userId}`,
    );
  }

  @OnEvent('notifications.read')
  handleNotificationsRead(event: { userId: string; notificationIds: string[] }) {
    this.markNotificationsRead(event.userId, event.notificationIds);
  }

  @OnEvent('unread.count.updated')
  handleUnreadCountUpdated(event: { userId: string; unreadCount: number }) {
    this.updateUnreadCount(event.userId, event.unreadCount);
  }

  // Client management helpers
  private addClient(userId: string, client: Socket): void {
    if (!this.connectedClients.has(userId)) {
      this.connectedClients.set(userId, new Set());
    }
    this.connectedClients.get(userId)!.add(client);
  }

  private removeClient(userId: string, client: Socket): void {
    const clients = this.connectedClients.get(userId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.connectedClients.delete(userId);
      }
    }
  }

  getConnectedClientsCount(): number {
    return Array.from(this.connectedClients.values()).reduce(
      (total, clients) => total + clients.size,
      0,
    );
  }
}
