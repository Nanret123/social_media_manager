import { Test, TestingModule } from '@nestjs/testing';
import { SocialAccountService } from './social-account.service';

describe('SocialAccountService', () => {
  let service: SocialAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialAccountService],
    }).compile();

    service = module.get<SocialAccountService>(SocialAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
