import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './mail/mail.module';
import { RedisModule } from './redis/redis.module';
import { PostsModule } from './posts/posts.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsModule } from './role-permissions/permissions.module';
import { UserModule } from './user/user.module';
import { SocialPostingModule } from './social-posting/social-posting.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { BillingModule } from './billing/billing.module';
import { AiModule } from './ai/ai.module';
import { MessagingModule } from './messaging/messaging.module';
import { TemplatesModule } from './templates/templates.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationModule } from './notification/notification.module';
import { SocialIntegrationModule } from './social-integration/social-integration.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { BrandKitModule } from './brand-kit/brand-kit.module';
import { PollingModule } from './polling/polling.module';
import { SocialAccountModule } from './social-account/social-account.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MetaModule } from './social-integration/meta/meta.module';


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
        limit: 10, // 100 requests per minute
      },
    ]),

    // Task scheduling
    ScheduleModule.forRoot(),

    MailModule,


    RedisModule,

    PostsModule,


    AiModule,

    MessagingModule,

    TemplatesModule,


    WebhookModule,

    AnalyticsModule,

    NotificationModule,

    SocialIntegrationModule,

    RateLimitModule,

    BrandKitModule,

    MetaModule,


    //AuditModule,

    //PollingModule,

    SocialAccountModule,

    OrganizationsModule,

    BillingModule,

    SchedulingModule,

    ApprovalsModule,

    SocialPostingModule,

    UserModule,

    PermissionsModule,
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
