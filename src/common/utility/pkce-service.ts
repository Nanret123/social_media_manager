import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PKCEService {
  generateVerifier(length: number = 128): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
  }

  generateChallenge(
    verifier: string,
    method: 'plain' | 'S256' = 'plain',
  ): string {
    if (method === 'plain') {
      return verifier;
    } else {
      // For S256 method
      const hash = crypto.createHash('sha256').update(verifier).digest();
      return this.base64urlEncode(hash);
    }
  }

  private base64urlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
