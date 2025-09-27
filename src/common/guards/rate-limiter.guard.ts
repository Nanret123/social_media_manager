import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TooManyRequestsException } from '../filters/too-many-requests.exception';
import { RateLimitService } from 'src/rate-limit/rate-limit.service';
import { RATE_LIMIT } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>(
      RATE_LIMIT,
      context.getHandler(),
    );
    if (!action) return true; // no limit set → allow

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const organizationId = request.user?.organizationId;

    if (!userId) return true; // optionally handle unauthenticated users

    try {
      await this.rateLimitService.checkLimit(
        'AI', // you can pass platform or action type here
        userId,
        action,
      );
      return true;
    } catch (err: any) {
      if (err instanceof TooManyRequestsException) throw err;
      throw new TooManyRequestsException('Rate limit check failed');
    }
  }
}
