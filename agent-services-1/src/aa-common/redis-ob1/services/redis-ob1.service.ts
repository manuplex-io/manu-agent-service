// import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import Redis from 'ioredis';

// @Injectable()
// export class RedisOb1Service implements OnModuleDestroy {
//   private readonly redis: Redis;
//   private readonly logger = new Logger(RedisOb1Service.name);

//   constructor(private configService: ConfigService) {
//     this.redis = new Redis({
//       host: this.configService.get<string>('REDIS_STACK_HOST', 'localhost'),
//       port: this.configService.get<number>('REDIS_STACK_PORT', 6379),
//       password: this.configService.get<string>('REDIS_STACK_PASSWORD'),
//     });

//     this.redis.on('connect', () => {
//       this.logger.log('Redis client connected');
//     });

//     this.redis.on('error', (error) => {
//       this.logger.error('Redis client error:', error);
//     });
//   }

//   async onModuleDestroy() {
//     await this.redis.quit();
//   }

//   getClient(): Redis {
//     return this.redis;
//   }

//   // Helper methods
//   async set(key: string, value: string | Set<string>, ttl: number = Number(process.env.REDIS_DEFAULT_TTL_FOR_TEMPORAL_WORKFLOW)): Promise<'OK'> {
//     try {
//       if (value instanceof Set) {
//         // Convert Set to array and use Redis SADD
//         const members = Array.from(value);
//         await this.redis.del(key); // Clear existing set if any
//         if (members.length > 0) {
//           await this.redis.sadd(key, ...members);
//         }
//         if (ttl) {
//           await this.redis.expire(key, ttl);
//         }
//         return 'OK';
//       } else {
//         // Handle regular string values as before
//         if (ttl) {
//           return this.redis.set(key, value, 'EX', ttl);
//         }
//         return this.redis.set(key, value);
//       }
//     } catch (error) {
//       this.logger.error(`Failed to set value for key ${key}: ${error.message}`);
//       throw error;
//     }
//   }

//   async setJson(key: string, value: Record<string, any>, ttl: number = Number(process.env.REDIS_DEFAULT_TTL_FOR_TEMPORAL_WORKFLOW)): Promise<'OK'> {
//     try {
//       // Use JSON.SET to store the JSON value
//       const jsonObject = JSON.stringify(value);
//       await this.redis.set(key, jsonObject);

//       if (ttl) {
//         await this.redis.expire(key, ttl);
//       }
//       return 'OK';
//     } catch (error) {
//       this.logger.error(`Failed to set JSON value for key ${key}: ${error.message}`);
//       throw error;
//     }
//   }

//   async get(key: string): Promise<string | null> {
//     try {
//       const value = await this.redis.get(key);
//       if (!value) return null;
//       return value;
//     } catch (error) {
//       this.logger.error(`Failed to get value for key ${key}: ${error.message}`);
//       throw error;
//     }
//   }

//   async getSet(key: string): Promise<Set<string> | null> {
//     try {
//       const members = await this.redis.smembers(key);
//       if (!members || members.length === 0) return null;
//       return new Set(members);
//     } catch (error) {
//       this.logger.error(`Failed to get set members for key ${key}: ${error.message}`);
//       throw error;
//     }
//   }

//   async del(key: string): Promise<number> {
//     return this.redis.del(key);
//   }
//   async updateTTL(key: string | Array<string>, ttl: number = Number(process.env.REDIS_DEFAULT_TTL_FOR_TEMPORAL_WORKFLOW)): Promise<boolean> {
//     try {
//       if (Array.isArray(key)) {
//         const results = await Promise.all(
//           key.map(k => this.redis.expire(k, ttl))
//         );
//         return results.every(result => result === 1);
//       } else {
//         const result = await this.redis.expire(key, ttl);
//         return result === 1;
//       }
//     } catch (error) {
//       this.logger.error(`Failed to update TTL for key ${key}: ${error.message}`);
//       throw error;
//     }
//   }


// }