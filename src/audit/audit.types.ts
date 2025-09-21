export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'SCHEDULE'
  | 'PUBLISH'
  | 'CONNECT'
  | 'DISCONNECT';

export type AuditResource =
  | 'USER'
  | 'ORGANIZATION'
  | 'POST'
  | 'SCHEDULE'
  | 'TEMPLATE'
  | 'BRAND_KIT'
  | 'SOCIAL_ACCOUNT'
  | 'REPORT'
  | 'AI_GENERATION'
  | 'MESSAGE'
  | 'CONVERSATION';

export interface AuditLog {
  id: string;
  organizationId?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  createdAt: Date;
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  organizationId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  status?: 'SUCCESS' | 'FAILED';
  search?: string;
}

export interface AuditStats {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  topUsers: { userId: string; count: number; email: string }[];
  topActions: { action: AuditAction; count: number }[];
  dailyActivity: { date: string; count: number }[];
}