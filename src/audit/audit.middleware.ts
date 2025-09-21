import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';
import { RequestContextService } from '../../shared/context/request-context.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);
  private readonly excludedPaths = ['/health', '/metrics', '/audit/logs'];
  private readonly excludedMethods = ['GET', 'OPTIONS', 'HEAD'];

  constructor(
    private readonly auditService: AuditService,
    private readonly contextService: RequestContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (this.shouldSkipAudit(req)) {
      return next();
    }

    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    // Capture response data
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;

    res.send = function (body: any): any {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function (body: any): any {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        await this.logAuditEvent(req, res, duration, responseBody);
      } catch (error) {
        // Don't break the response if audit logging fails
        this.logger.error('Audit logging failed:', error);
      }
    });

    next();
  }

  private shouldSkipAudit(req: Request): boolean {
    return (
      this.excludedMethods.includes(req.method) ||
      this.excludedPaths.some(path => req.originalUrl.startsWith(path))
    );
  }

  private async logAuditEvent(req: Request, res: Response, duration: number, responseBody: any): Promise<void> {
    const context = this.contextService.getContext();
    const { method, originalUrl, params, query, body } = req;

    // Determine action and resource from request
    const { action, resource, resourceId } = this.parseRequestDetails(req);
    
    const status = res.statusCode >= 200 && res.statusCode < 400 ? 'SUCCESS' : 'FAILED';
    const error = status === 'FAILED' ? this.getErrorMessage(responseBody) : undefined;

    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      action,
      resource,
      resourceId,
      description: this.getEventDescription(req, res, duration),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        method,
        endpoint: originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        params: this.sanitizeData(params),
        query: this.sanitizeData(query),
        body: this.sanitizeData(body),
        response: this.sanitizeData(responseBody),
      },
      status,
      error,
    });
  }

  private parseRequestDetails(req: Request): { action: string; resource: string; resourceId?: string } {
    const { method, originalUrl, params } = req;

    // Map HTTP methods to actions
    const actionMap: { [key: string]: string } = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    const action = actionMap[method] || 'EXECUTE';

    // Extract resource from URL
    const resource = this.extractResourceFromUrl(originalUrl);
    const resourceId = params.id || this.extractResourceId(originalUrl);

    return { action, resource, resourceId };
  }

  private extractResourceFromUrl(url: string): string {
    const segments = url.split('/').filter(segment => segment);
    
    // Skip API version prefix if present
    const startIndex = segments[0] === 'v1' || segments[0] === 'api' ? 1 : 0;
    
    if (segments.length > startIndex) {
      const resource = segments[startIndex].toUpperCase().replace(/-/g, '_');
      return resource || 'UNKNOWN';
    }
    
    return 'UNKNOWN';
  }

  private extractResourceId(url: string): string | undefined {
    const segments = url.split('/').filter(segment => segment);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cuidRegex = /^c[a-z0-9]{24}$/i;

    for (const segment of segments.reverse()) {
      if (uuidRegex.test(segment) || cuidRegex.test(segment)) {
        return segment;
      }
    }

    return undefined;
  }

  private getEventDescription(req: Request, res: Response, duration: number): string {
    const { method, originalUrl } = req;
    const { action, resource } = this.parseRequestDetails(req);
    
    return `${action} ${resource} operation completed with status ${res.statusCode} in ${duration}ms`;
  }

  private getErrorMessage(responseBody: any): string | undefined {
    if (!responseBody) return undefined;

    try {
      const body = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
      return body.message || body.error || undefined;
    } catch {
      return typeof responseBody === 'string' ? responseBody.substring(0, 200) : 'Unknown error';
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    const sensitiveFields = ['password', 'token', 'secret', 'accessKey', 'refreshToken', 'apiKey', 'authorization'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}