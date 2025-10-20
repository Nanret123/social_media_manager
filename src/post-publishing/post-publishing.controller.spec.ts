import { Test, TestingModule } from '@nestjs/testing';
import { PostPublishingController } from './post-publishing.controller';
import { PostPublishingService } from './post-publishing.service';

describe('PostPublishingController', () => {
  let controller: PostPublishingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostPublishingController],
      providers: [PostPublishingService],
    }).compile();

    controller = module.get<PostPublishingController>(PostPublishingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
