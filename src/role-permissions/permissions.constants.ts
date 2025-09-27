import { PermissionCategory } from "./types/index.types";

export const SYSTEM_PERMISSIONS = {
  // Post Permissions
  POST_CREATE: {
    name: 'post:create',
    description: 'Create and schedule posts',
    category: PermissionCategory.POST,
  },
  POST_EDIT: {
    name: 'post:edit',
    description: 'Edit existing posts',
    category: PermissionCategory.POST,
  },
  POST_DELETE: {
    name: 'post:delete',
    description: 'Delete posts',
    category: PermissionCategory.POST,
  },
  POST_APPROVE: {
    name: 'post:approve',
    description: 'Approve posts for publishing',
    category: PermissionCategory.POST,
  },
  POST_PUBLISH: {
    name: 'post:publish',
    description: 'Publish posts immediately',
    category: PermissionCategory.POST,
  },

  // Message Permissions
  MESSAGE_READ: {
    name: 'message:read',
    description: 'Read incoming messages',
    category: PermissionCategory.MESSAGE,
  },
  MESSAGE_REPLY: {
    name: 'message:reply',
    description: 'Reply to messages',
    category: PermissionCategory.MESSAGE,
  },
  MESSAGE_ASSIGN: {
    name: 'message:assign',
    description: 'Assign conversations to team members',
    category: PermissionCategory.MESSAGE,
  },

  // Analytics Permissions
  ANALYTICS_VIEW: {
    name: 'analytics:view',
    description: 'View analytics and reports',
    category: PermissionCategory.ANALYTICS,
  },
  ANALYTICS_EXPORT: {
    name: 'analytics:export',
    description: 'Export analytics data',
    category: PermissionCategory.ANALYTICS,
  },

  // Settings Permissions
  SETTINGS_MANAGE: {
    name: 'settings:manage',
    description: 'Manage account settings',
    category: PermissionCategory.SETTINGS,
  },
  SOCIAL_ACCOUNT_MANAGE: {
    name: 'social_account:manage',
    description: 'Connect and manage social accounts',
    category: PermissionCategory.SETTINGS,
  },

  // User Management Permissions
  MEMBER_INVITE: {
    name: 'member:invite',
    description: 'Invite new team members',
    category: PermissionCategory.USER_MANAGEMENT,
  },
  MEMBER_MANAGE: {
    name: 'member:manage',
    description: 'Manage team member roles and permissions',
    category: PermissionCategory.USER_MANAGEMENT,
  },
  MEMBER_REMOVE: {
    name: 'member:remove',
    description: 'Remove team members',
    category: PermissionCategory.USER_MANAGEMENT,
  },

  // Billing Permissions
  BILLING_VIEW: {
    name: 'billing:view',
    description: 'View billing information',
    category: PermissionCategory.BILLING,
  },
  BILLING_MANAGE: {
    name: 'billing:manage',
    description: 'Manage billing and subscriptions',
    category: PermissionCategory.BILLING,
  },
} as const;

export const SYSTEM_ROLES = {
  // Organization Roles
  ORGANIZATION_OWNER: {
    name: 'Organization Owner',
    scope: 'ORGANIZATION' as const,
    description: 'Full access to all organization features and settings',
    permissions: Object.values(SYSTEM_PERMISSIONS).map((p) => p.name),
    isDefault: false,
  },
  ORGANIZATION_ADMIN: {
    name: 'Organization Admin',
    scope: 'ORGANIZATION' as const,
    description: 'Manage team members and organization settings',
    permissions: [
      'member:invite',
      'member:manage',
      'member:remove',
      'social_account:manage',
      'settings:manage',
      'post:create',
      'post:edit',
      'post:delete',
      'post:approve',
      'post:publish',
      'message:read',
      'message:reply',
      'message:assign',
      'analytics:view',
      'analytics:export',
      'billing:view',
    ],
    isDefault: false,
  },
  ORGANIZATION_MEMBER: {
    name: 'Organization Member',
    scope: 'ORGANIZATION' as const,
    description: 'Basic access to create content and view analytics',
    permissions: [
      'post:create',
      'post:edit',
      'message:read',
      'message:reply',
      'analytics:view',
    ],
    isDefault: true,
  },

  // Social Account Roles
  SOCIAL_ACCOUNT_MANAGER: {
    name: 'Social Account Manager',
    scope: 'SOCIAL_ACCOUNT' as const,
    description: 'Full access to manage social account and content',
    permissions: [
      'post:create',
      'post:edit',
      'post:delete',
      'post:approve',
      'post:publish',
      'message:read',
      'message:reply',
      'message:assign',
      'analytics:view',
      'analytics:export',
      'settings:manage',
    ],
    isDefault: false,
  },
  SOCIAL_ACCOUNT_CONTRIBUTOR: {
    name: 'Social Account Contributor',
    scope: 'SOCIAL_ACCOUNT' as const,
    description: 'Create and edit content for social accounts',
    permissions: [
      'post:create',
      'post:edit',
      'message:read',
      'message:reply',
      'analytics:view',
    ],
    isDefault: true,
  },
  SOCIAL_ACCOUNT_ANALYST: {
    name: 'Social Account Analyst',
    scope: 'SOCIAL_ACCOUNT' as const,
    description: 'View analytics and reports for social accounts',
    permissions: ['analytics:view', 'analytics:export'],
    isDefault: false,
  },
} as const;
