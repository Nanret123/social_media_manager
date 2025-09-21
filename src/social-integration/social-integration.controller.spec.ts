import { Test, TestingModule } from '@nestjs/testing';
import { SocialIntegrationController } from './social-integration.controller';
import { SocialIntegrationService } from './social-integration.service';

describe('SocialIntegrationController', () => {
  let controller: SocialIntegrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialIntegrationController],
      providers: [SocialIntegrationService],
    }).compile();

    controller = module.get<SocialIntegrationController>(SocialIntegrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
