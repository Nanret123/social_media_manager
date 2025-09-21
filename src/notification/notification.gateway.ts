import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId: string;
  organizationId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'notifications'
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, Socket[]>(); // userId -> Socket[]

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle new client connection with authentication
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // Authenticate via JWT from handshake or query params
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token.toString());
      client.userId = payload.sub;
      client.organizationId = payload.organizationId;

      // Track connected client
      this.addClient(client.userId, client);
      
      // Join room for user-specific notifications
      client.join(`user:${client.userId}`);
      
      // Join room for organization-wide notifications
      client.join(`org:${client.organizationId}`);

      this.logger.log(`Client connected: ${client.userId} from organization ${client.organizationId}`);
      
      // Send connection acknowledgement
      client.emit('connected', { 
        message: 'Successfully connected to notifications',
        userId: client.userId 
      });

    } catch (error) {
      this.logger.error('Authentication failed for client:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    this.removeClient(client.userId, client);
    this.logger.log(`Client disconnected: ${client.userId}`);
  }

  /**
   * Handle client subscribing to conversation updates
   */
  @SubscribeMessage('subscribe:conversation')
  handleSubscribeToConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ): void {
    client.join(`conversation:${data.conversationId}`);
    client.emit('subscribed', { 
      conversationId: data.conversationId,
      message: 'Subscribed to conversation updates'
    });
  }

  /**
   * Handle client unsubscribing from conversation
   */
  @SubscribeMessage('unsubscribe:conversation')
  handleUnsubscribeFromConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ): void {
    client.leave(`conversation:${data.conversationId}`);
    client.emit('unsubscribed', { 
      conversationId: data.conversationId,
      message: 'Unsubscribed from conversation updates'
    });
  }

  /**
   * Notify all users in an organization about a new message
   */
  async notifyNewMessage(organizationId: string, conversationId: string, message: any): Promise<void> {
    this.server.to(`org:${organizationId}`).emit('message:new', {
      conversationId,
      message,
      timestamp: new Date()
    });

    // Also notify users specifically subscribed to this conversation
    this.server.to(`conversation:${conversationId}`).emit('conversation:message:new', {
      conversationId,
      message,
      timestamp: new Date()
    });

    this.logger.log(`New message notification sent for conversation ${conversationId}`);
  }

  /**
   * Notify about conversation assignment
   */
  async notifyConversationAssigned(conversationId: string, assigneeId: string): Promise<void> {
    this.server.to(`user:${assigneeId}`).emit('conversation:assigned', {
      conversationId,
      assigneeId,
      timestamp: new Date()
    });

    this.server.to(`conversation:${conversationId}`).emit('conversation:assignment:updated', {
      conversationId,
      assigneeId,
      timestamp: new Date()
    });
  }

  /**
   * Notify about conversation status change
   */
  async notifyConversationStatusChanged(conversationId: string, status: string): Promise<void> {
    this.server.to(`conversation:${conversationId}`).emit('conversation:status:updated', {
      conversationId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Notify user about new unread count
   */
  async notifyUnreadCount(userId: string, unreadCount: number): Promise<void> {
    this.server.to(`user:${userId}`).emit('unread:count:updated', {
      unreadCount,
      timestamp: new Date()
    });
  }

  // --- Helper Methods for Client Management ---

  private addClient(userId: string, client: Socket): void {
    if (!this.connectedClients.has(userId)) {
      this.connectedClients.set(userId, []);
    }
    this.connectedClients.get(userId)!.push(client);
  }

  private removeClient(userId: string, client: Socket): void {
    const clients = this.connectedClients.get(userId);
    if (clients) {
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.connectedClients.delete(userId);
      }
    }
  }

  getConnectedClientsCount(): number {
    return Array.from(this.connectedClients.values()).reduce(
      (total, clients) => total + clients.length, 0
    );
  }
}