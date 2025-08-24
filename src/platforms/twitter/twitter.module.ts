import { Module } from '@nestjs/common';
import { TwitterService } from './twitter.service';
import { TwitterController } from './twitter.controller';
import { RedisModule } from 'src/redis/redis.module';
import { EncryptionService } from 'src/common/utility/encryption.service';

@Module({
  imports: [RedisModule],
  controllers: [TwitterController],
  providers: [TwitterService, EncryptionService],
  exports: [TwitterService],
})
export class TwitterModule {}
