// types/role-permission.types.ts
export enum PermissionCategory {
  POST = 'post',
  MESSAGE = 'message', 
  ANALYTICS = 'analytics',
  SETTINGS = 'settings',
  USER_MANAGEMENT = 'user_management',
  BILLING = 'billing'
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
  type: 'SYSTEM' | 'CUSTOM';
  scope: 'ORGANIZATION' | 'SOCIAL_ACCOUNT';
  description: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  granted: boolean;
}

export interface MemberWithPermissions {
  userId: string;
  role?: Role;
  permissions: Permission[];
}

export interface CreateRoleDto {
  name: string;
  scope: 'ORGANIZATION' | 'SOCIAL_ACCOUNT';
  description?: string;
  permissionIds: string[];
  isDefault?: boolean;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface AssignRoleDto {
  userId: string;
  roleId: string;
  assignedBy: string;
}