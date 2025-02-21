import { Module, Logger } from '@nestjs/common';
import { KafkaOb1Module } from './aa-common/kafka-ob1/kafka-ob1.module';

// common modules
import { ConfigModule } from '@nestjs/config';
import { PostgresOb1AgentServicesDbModule } from './aa-common/postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module';
import { RedisOb1Module } from './aa-common/redis-ob1/redis-ob1.module';
import { TSValidationOb1Module } from './aa-common/ts-validation-ob1/ts-validation-ob1.module';
import { AppHealthV1Controller } from './appHealthV1.controller';
// modules

import { LLMModule } from './llms/llms.module';
import { PromptModule } from './prompts/prompts.module';
import { ToolsModule } from './tools/tools.module';
import { ActivityModule } from './activity/activity.module';
import { WorkflowModule } from './workflows/workflows.module';
// import { RagModule } from './rags/rags.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // This will make .env configurations accessible throughout the app
    }),
    KafkaOb1Module,
    PostgresOb1AgentServicesDbModule,
    ToolsModule,
    LLMModule,
    PromptModule,
    ActivityModule,
    WorkflowModule,
    // RagModule,
    RedisOb1Module,
    TSValidationOb1Module,
  ],
  controllers: [
    AppHealthV1Controller,
  ],
  providers: [Logger,

  ],
})
export class AppModule { }
