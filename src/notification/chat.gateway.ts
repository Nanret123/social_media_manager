// chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  userId: string;
  organizationId: string;
}

interface JoinConversationData {
  conversationId: string;
}

interface SendMessageData {
  conversationId: string;
  content: string;
  messageId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly conversationSubscriptions = new Map<string, Set<string>>(); // conversationId -> userIds

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

      // Join organization room for broadcast messages
      client.join(`chat:org:${client.organizationId}`);

      this.logger.log(
        `Chat client connected: user=${client.userId}, org=${client.organizationId}`,
      );

      client.emit('connected', {
        message: 'Connected to chat service',
        userId: client.userId,
      });
    } catch (error) {
      this.logger.warn(`Chat connection rejected: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    // Remove user from all conversation subscriptions
    this.conversationSubscriptions.forEach((users, conversationId) => {
      users.delete(client.userId);
      if (users.size === 0) {
        this.conversationSubscriptions.delete(conversationId);
      }
    });

    this.logger.log(`Chat client disconnected: ${client.userId}`);
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ): void {
    const { conversationId } = data;
    
    // Join the conversation room
    client.join(`conversation:${conversationId}`);
    
    // Track subscription
    if (!this.conversationSubscriptions.has(conversationId)) {
      this.conversationSubscriptions.set(conversationId, new Set());
    }
    this.conversationSubscriptions.get(conversationId)!.add(client.userId);

    client.emit('conversation:joined', {
      conversationId,
      message: 'Successfully joined conversation',
    });

    this.logger.log(`User ${client.userId} joined conversation ${conversationId}`);
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ): void {
    const { conversationId } = data;
    
    client.leave(`conversation:${conversationId}`);
    
    // Remove subscription tracking
    const subscribers = this.conversationSubscriptions.get(conversationId);
    if (subscribers) {
      subscribers.delete(client.userId);
      if (subscribers.size === 0) {
        this.conversationSubscriptions.delete(conversationId);
      }
    }

    client.emit('conversation:left', {
      conversationId,
      message: 'Left conversation',
    });
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageData,
  ): Promise<void> {
    const { conversationId, content, messageId } = data;

    // Here you would typically save the message to database
    // For now, we'll broadcast it to conversation participants

    const message = {
      id: messageId || `temp-${Date.now()}`,
      conversationId,
      content,
      senderId: client.userId,
      timestamp: new Date(),
      status: 'sent',
    };

    // Broadcast to conversation room
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);

    this.logger.log(`User ${client.userId} sent message to conversation ${conversationId}`);
  }

  @SubscribeMessage('message:typing')
  handleTypingIndicator(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ): void {
    // Broadcast typing indicator to other participants
    client.to(`conversation:${data.conversationId}`).emit('user:typing', {
      userId: client.userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
      timestamp: new Date(),
    });
  }

  /**
   * Event handlers for real-time conversation updates
   */
  @OnEvent('conversation.message.created')
  handleNewMessageEvent(payload: {
    conversationId: string;
    message: any;
    organizationId: string;
  }): void {
    this.server.to(`conversation:${payload.conversationId}`).emit('message:new', {
      ...payload.message,
      timestamp: new Date(),
    });

    // Also notify organization for inbox updates
    this.server.to(`chat:org:${payload.organizationId}`).emit('conversation:updated', {
      conversationId: payload.conversationId,
      lastMessage: payload.message.content,
      lastActivity: new Date(),
    });
  }

  @OnEvent('conversation.assigned')
  handleConversationAssigned(payload: {
    conversationId: string;
    assigneeId: string;
    assignedBy: string;
    organizationId: string;
  }): void {
    // Notify the new assignee specifically
    this.server.to(`user:${payload.assigneeId}`).emit('conversation:assigned', {
      ...payload,
      timestamp: new Date(),
    });

    // Notify all conversation participants
    this.server.to(`conversation:${payload.conversationId}`).emit('conversation:assignment_updated', {
      ...payload,
      timestamp: new Date(),
    });
  }

  @OnEvent('conversation.status.changed')
  handleConversationStatusChanged(payload: {
    conversationId: string;
    status: string;
    changedBy: string;
    organizationId: string;
  }): void {
    this.server.to(`conversation:${payload.conversationId}`).emit('conversation:status_updated', {
      ...payload,
      timestamp: new Date(),
    });
  }

  @OnEvent('conversation.read.receipt')
  handleReadReceipt(payload: {
    conversationId: string;
    userId: string;
    readUntil: Date;
  }): void {
    // Notify other participants that messages were read
    this.server.to(`conversation:${payload.conversationId}`).emit('messages:read', {
      ...payload,
      timestamp: new Date(),
    });
  }

  /**
   * Get active subscribers for a conversation (useful for analytics)
   */
  getConversationSubscribers(conversationId: string): string[] {
    const subscribers = this.conversationSubscriptions.get(conversationId);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Get all active conversations for a user
   */
  getUserSubscriptions(userId: string): string[] {
    const conversations: string[] = [];
    this.conversationSubscriptions.forEach((users, conversationId) => {
      if (users.has(userId)) {
        conversations.push(conversationId);
      }
    });
    return conversations;
  }
}