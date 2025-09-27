import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = 'RATE_LIMIT';
export const RateLimit = (action: string) => SetMetadata(RATE_LIMIT, action);
