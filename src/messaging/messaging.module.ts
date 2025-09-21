import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { InboxListener } from './listeners/inbox.listener';
import { MessagingService } from './messaging.service';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, InboxListener],

})
export class MessagingModule {}
