import { Controller } from '@nestjs/common';
import { SocialPostingService } from './social-posting.service';

@Controller('social-posting')
export class SocialPostingController {
  constructor(private readonly socialPostingService: SocialPostingService) {}
}
