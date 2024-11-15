// /src/postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module.ts

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
// tools
import { OB1AgentTools } from '../tools/entities/ob1-agent-tools.entity';
import { OB1ToolCategory } from '../tools/entities/ob1-agent-toolCategory.entity';
import { OB1ToolExecutionLog } from 'src/tools/entities/ob1-agent-toolExecutionLog.entity';
// prompts
import { OB1AgentPrompts } from 'src/prompts/entities/ob1-agent-prompts.entity';
import { OB1PromptExecutionLog } from 'src/prompts/entities/ob1-agent-promptExecutionLog.entity';

@Global() //no need to import this module in other modules
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // This will make .env configurations accessible throughout the app
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.OB1_DB_HOST,
      port: +process.env.OB1_DB_PORT,
      username: process.env.ENV === 'dev' ? process.env.OB1_DB_USERNAME_AGENTSERVICE_DEV : process.env.OB1_DB_USERNAME_AGENTSERVICE,
      password: process.env.ENV === 'dev' ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_DEV : process.env.OB1_DB_PASSWORD_AGENTSERVICE,
      database: process.env.OB1_DB_DATABASE_AGENTSERVICE,
      entities: [
        OB1AgentTools,
        OB1ToolCategory,
        OB1ToolExecutionLog,
        OB1AgentPrompts,
        OB1PromptExecutionLog,
      ], // Add the entities relevant to this DB
      synchronize: true,
      // synchronize: process.env.ENV === 'dev',  // Only synchronize in the 'dev' environment
    }),
    TypeOrmModule.forFeature([
      OB1AgentTools,
      OB1ToolCategory,
      OB1ToolExecutionLog,
      OB1AgentPrompts,
      OB1PromptExecutionLog,
    ]), // Register the entities for repositories in your services
  ],
  exports: [TypeOrmModule],
})
export class PostgresOb1AgentServicesDbModule { }
