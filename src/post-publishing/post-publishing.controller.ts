import { Controller } from '@nestjs/common';
import { PostPublishingService } from './post-publishing.service';

@Controller('post-publishing')
export class PostPublishingController {
  constructor(private readonly postPublishingService: PostPublishingService) {}
}
