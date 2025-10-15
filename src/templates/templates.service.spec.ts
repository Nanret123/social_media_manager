import { Test, TestingModule } from '@nestjs/testing';
import { ContentTemplatesService } from './templates.service';


describe('TemplatesService', () => {
  let service: ContentTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentTemplatesService],
    }).compile();

    service = module.get<ContentTemplatesService>(ContentTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
