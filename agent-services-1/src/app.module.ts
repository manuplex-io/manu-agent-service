import { Module, Logger } from '@nestjs/common';
import { KafkaOb1Module } from './aa-common/kafka-ob1/kafka-ob1.module';

// common modules
import { ConfigModule } from '@nestjs/config';
import { PostgresOb1AgentServicesDbModule } from './aa-common/postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module';

// modules

import { LLMModule } from './llms/llms.module';
import { PromptModule } from './prompts/prompts.module';
import { ToolsModule } from './tools/tools.module';
import { ActivityModule } from './activity/activity.module';
import { WorkflowModule } from './workflows/workflows.module';

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
  ],
  controllers: [

  ],
  providers: [Logger,

  ],
})
export class AppModule { }
