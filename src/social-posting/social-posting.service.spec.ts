import { Test, TestingModule } from '@nestjs/testing';
import { SocialPostingService } from './social-posting.service';

describe('SocialPostingService', () => {
  let service: SocialPostingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialPostingService],
    }).compile();

    service = module.get<SocialPostingService>(SocialPostingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
