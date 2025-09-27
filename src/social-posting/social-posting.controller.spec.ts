import { Test, TestingModule } from '@nestjs/testing';
import { SocialPostingController } from './social-posting.controller';
import { SocialPostingService } from './social-posting.service';

describe('SocialPostingController', () => {
  let controller: SocialPostingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialPostingController],
      providers: [SocialPostingService],
    }).compile();

    controller = module.get<SocialPostingController>(SocialPostingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
