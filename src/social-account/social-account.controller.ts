import { Controller } from '@nestjs/common';
import { SocialAccountService } from './social-account.service';

@Controller('social-account')
export class SocialAccountController {
  constructor(private readonly socialAccountService: SocialAccountService) {}
}
