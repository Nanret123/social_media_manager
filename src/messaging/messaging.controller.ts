import { Controller } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('inbox')
export class MessagingController {
  constructor(private readonly inboxService: MessagingService) {}
}
