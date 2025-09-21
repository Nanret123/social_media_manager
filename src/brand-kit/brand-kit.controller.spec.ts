import { Test, TestingModule } from '@nestjs/testing';
import { BrandKitController } from './brand-kit.controller';
import { BrandKitService } from './brand-kit.service';

describe('BrandKitController', () => {
  let controller: BrandKitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandKitController],
      providers: [BrandKitService],
    }).compile();

    controller = module.get<BrandKitController>(BrandKitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
