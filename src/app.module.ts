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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
