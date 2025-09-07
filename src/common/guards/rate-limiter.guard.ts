import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from 'src/redis/redis.service';
import { TooManyRequestsException } from '../filters/too-many-requests.exception';

export const RATE_LIMIT = 'rate_limit';
export const RateLimit = (operation: keyof typeof RateLimitGuard.RATE_LIMITS) =>
  SetMetadata(RATE_LIMIT, operation);

@Injectable()
export class RateLimitGuard implements CanActivate {
  static readonly RATE_LIMITS = {
    CONTENT_GENERATION: { limit: 50, window: 3600 },
    IMAGE_GENERATION: { limit: 20, window: 3600 },
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const operation = this.reflector.get<string>(
      RATE_LIMIT,
      context.getHandler(),
    );

    if (!operation) return true; // no limit set → skip

    const { limit, window } = RateLimitGuard.RATE_LIMITS[operation];
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;
    const key = `rate_limit:${operation}:${userId}`;

    const current = await this.redisService.get(key);
    const currentCount = current ? parseInt(current) : 0;

    if (currentCount >= limit) {
      throw new TooManyRequestsException(
        `Rate limit exceeded for ${operation}. Try again in ${Math.ceil(
          window / 60,
        )} minutes.`,
      );
    }

    if (currentCount === 0) {
      await this.redisService.set(key, '1', window);
    } else {
      await this.redisService.incr(key);
    }

    return true;
  }
}
