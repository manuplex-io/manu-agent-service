import { Module, Global } from '@nestjs/common';
import { RedisOb1Service } from './services/redis-ob1.service';

@Global()
@Module({
  providers: [RedisOb1Service],
  exports: [RedisOb1Service],
})
export class RedisOb1Module {}