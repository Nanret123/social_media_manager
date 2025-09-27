// src/permission/dto/create-permission.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PermissionAction, PermissionResource, PermissionScope } from '@prisma/client';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Unique permission name (e.g. posts:create)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Optional description of the permission' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PermissionScope })
  @IsEnum(PermissionScope)
  scope: PermissionScope;

  @ApiProperty({ enum: PermissionResource })
  @IsEnum(PermissionResource)
  resource: PermissionResource;

  @ApiProperty({ enum: PermissionAction })
  @IsEnum(PermissionAction)
  action: PermissionAction;
}
