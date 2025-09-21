import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitController', () => {
  let controller: RateLimitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitController],
      providers: [RateLimitService],
    }).compile();

    controller = module.get<RateLimitController>(RateLimitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
