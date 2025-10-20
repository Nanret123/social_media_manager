
// bull-board.module.ts
import { Module, NestModule, MiddlewareConsumer, INestApplication, Inject, OnModuleInit } from '@nestjs/common';
import { BullModule, getQueueToken, InjectQueue } from '@nestjs/bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bull';

@Module({
  imports: [
    // Make sure this matches your existing queue name
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
      queues: [new BullAdapter(this.socialPostingQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  public mount(app: INestApplication) {
    app.use(this.basePath, this.serverAdapter.getRouter());
  }
}
