interface BaseNotificationEvent {
  organizationId: string;
  source: 'post' | 'message' | 'system' | 'mention';
}

interface InboxMessageEvent extends BaseNotificationEvent {
  conversationId: string;
  messageId: string;
  sender: string;
  preview: string;
  platform: string;
  // Add socialAccountId for permission checks
  socialAccountId?: string;
}

interface PostApprovalEvent extends BaseNotificationEvent {
  postId: string;
  authorId: string;
  socialAccountId: string;
  postTitle?: string;
}