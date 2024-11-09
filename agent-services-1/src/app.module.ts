import { Module } from '@nestjs/common';
import { KafkaOb1Module } from './kafka-ob1/kafka-ob1.module';
import { ConfigModule } from '@nestjs/config';
import { PostgresOb1AgentServicesDbModule } from './postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module';
import { ToolsModule } from './tools/tools.module';
import { LLMModule } from './llms/llms.module';
import { Logger } from '@nestjs/common';
import { PromptModule } from './prompts/prompts.module';
import { WORKFLOWSModule } from './workflows/workflows.module';

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
    WORKFLOWSModule,
  ],
  controllers: [

  ],
  providers: [Logger,

  ],
})
export class AppModule { }
