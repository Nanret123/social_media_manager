import { Test, TestingModule } from '@nestjs/testing';
import { SocialIntegrationService } from './social-integration.service';

describe('SocialIntegrationService', () => {
  let service: SocialIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialIntegrationService],
    }).compile();

    service = module.get<SocialIntegrationService>(SocialIntegrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
