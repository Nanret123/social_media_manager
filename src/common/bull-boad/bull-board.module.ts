import { Module, INestApplication, OnModuleInit, Inject } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'social-posting',
    }),
  ],
})
export class BullBoardModule implements OnModuleInit {
  private serverAdapter = new ExpressAdapter();
  private readonly basePath = '/admin/queues';

  constructor(
    @Inject(getQueueToken('social-posting'))
    private readonly socialPostingQueue: Queue,
  ) {}

  onModuleInit() {
    this.serverAdapter.setBasePath(this.basePath);

    createBullBoard({
      queues: [new BullMQAdapter(this.socialPostingQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  public mount(app: INestApplication) {
    app.use(this.basePath, this.serverAdapter.getRouter());
  }
}

