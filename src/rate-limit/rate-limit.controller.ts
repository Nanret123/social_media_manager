import { Controller } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

import { Controller, Get, Query } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

@Controller('rate-limits')
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Get('usage')
  async getRateLimitUsage(@Query('socialAccountId') socialAccountId: string) {
    return this.rateLimitService.getRateLimitUsage(socialAccountId);
  }

  @Get('recommendations')
  async getRecommendedTimes(
    @Query('socialAccountId') socialAccountId: string,
    @Query('platform') platform: string,
    @Query('count') count: number = 5
  ) {
    return this.rateLimitService.getRecommendedPostTimes(socialAccountId, platform, count);
  }
}
