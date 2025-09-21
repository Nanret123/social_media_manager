import { Controller } from '@nestjs/common';
import { SocialIntegrationService } from './social-integration.service';

@Controller('social-integration')
export class SocialIntegrationController {
  constructor(private readonly socialIntegrationService: SocialIntegrationService) {}
}
