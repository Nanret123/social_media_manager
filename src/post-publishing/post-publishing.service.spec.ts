import { Test, TestingModule } from '@nestjs/testing';
import { PostPublishingService } from './post-publishing.service';

describe('PostPublishingService', () => {
  let service: PostPublishingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostPublishingService],
    }).compile();

    service = module.get<PostPublishingService>(PostPublishingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
