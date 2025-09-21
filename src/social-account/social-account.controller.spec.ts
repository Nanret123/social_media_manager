import { Test, TestingModule } from '@nestjs/testing';
import { SocialAccountController } from './social-account.controller';
import { SocialAccountService } from './social-account.service';

describe('SocialAccountController', () => {
  let controller: SocialAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialAccountController],
      providers: [SocialAccountService],
    }).compile();

    controller = module.get<SocialAccountController>(SocialAccountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
