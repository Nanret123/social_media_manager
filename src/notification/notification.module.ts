import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { NotificationsListener } from './listeners/notifications.listener';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsListener, NotificationsGateway],
})
export class NotificationModule {}
