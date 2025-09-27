import { Module } from '@nestjs/common';
import { PermissionController } from './permissions.controller';
import { PermissionService } from './role-permission.service';


@Module({
  controllers: [PermissionController],
  providers: [PermissionService],
})
export class PermissionsModule {}
