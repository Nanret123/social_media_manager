import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message?: string) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: message || 'Rate limit exceeded. Please wait before retrying.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}