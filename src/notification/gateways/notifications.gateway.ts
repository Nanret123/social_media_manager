// src/notifications/gateways/notifications.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Notification } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  @OnEvent('notification.created')
  handleNotificationCreated(notification: Notification) {
    this.logger.debug(`Sending real-time notification to user ${notification.userId}`);
    
    // Send to specific user's room
    this.server
      .to(`user:${notification.userId}`)
      .emit('notification:new', notification);
  }

  // Handle client connections
  handleConnection(client: any) {
    const userId = client.handshake.query.userId;
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`User ${userId} connected to notifications`);
    }
  }

  handleDisconnect(client: any) {
    this.logger.log('Client disconnected from notifications');
  }
}