import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { BullModule } from '@nestjs/bullmq';
import { WebhookQueueService } from './queues/webhook-queue.service';
import { MetaWebhookStrategy } from './strategies/meta-webhook.strategy';
import { WebhookWorker } from './workers/webhook.worker';
import { WebhookProcessingService } from './webhook-processing.service';

@Module({
  imports: [
    // Register the queue module-wide
    BullModule.registerQueue({
      name: 'webhook-processing',
      // Redis config should come from environment variables
      // redis: { host: 'localhost', port: 6379 },
    }),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookQueueService,
     WebhookProcessingService,
   // WebhookWorker,
    MetaWebhookStrategy,
  ],
})
export class WebhookModule {}
