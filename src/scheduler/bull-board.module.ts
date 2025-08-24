import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { INestApplication } from '@nestjs/common';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';

@Module({})
export class BullBoardModule implements OnModuleInit {
  private serverAdapter: ExpressAdapter;

  constructor(
    @Inject(getQueueToken('post-publishing'))
    private readonly postQueue: Queue,
  ) {}

  onModuleInit() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullAdapter(this.postQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  setup(app: INestApplication) {
    app.use('/admin/queues', this.serverAdapter.getRouter());
  }
}