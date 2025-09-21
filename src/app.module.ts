import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './mail/mail.module';
import { PlatformsModule } from './platforms/platforms.module';
import { RedisModule } from './redis/redis.module';
import { PostsModule } from './posts/posts.module';
import { SchedulerModule } from './posts/post-queue.module';
import { OrganizationModule } from './organization/organization.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { InvitationsModule } from './invitations/invitations.module';
import { AiModule } from './ai/ai.module';
import { MessagingModule } from './messaging/messaging.module';
import { TemplatesModule } from './templates/templates.module';
import { PostAnalyticsModule } from './post-analytics/post-analytics.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationModule } from './notification/notification.module';
import { SocialIntegrationModule } from './social-integration/social-integration.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { BrandKitModule } from './brand-kit/brand-kit.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { PollingModule } from './polling/polling.module';
import { SocialAccountModule } from './social-account/social-account.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
     ThrottlerModule.forRoot([
      {
        ttl: 60 * 1000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Task scheduling
    ScheduleModule.forRoot(),

    MailModule,

    PlatformsModule,

    RedisModule,

    PostsModule,

    SchedulerModule,

    OrganizationModule,

    InvitationsModule,

    AiModule,

    MessagingModule,

    TemplatesModule,

    PostAnalyticsModule,

    WebhookModule,

    AnalyticsModule,

    NotificationModule,

    SocialIntegrationModule,

    RateLimitModule,

    BrandKitModule,

    ReportsModule,

    AuditModule,

    PollingModule,

    SocialAccountModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
