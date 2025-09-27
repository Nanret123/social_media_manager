import { Module } from '@nestjs/common';
import { InboxListener } from './listeners/inbox.listener';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, InboxListener],

})
export class MessagingModule {}
