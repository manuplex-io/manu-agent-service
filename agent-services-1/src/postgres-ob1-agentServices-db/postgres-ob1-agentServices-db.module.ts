// /src/postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1ToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import { OB1ToolExecutionLog } from 'src/entities/ob1-agent-toolExecutionLog.entity';


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
        OB1ToolExecutionLog
      ], // Add the entities relevant to this DB
      // synchronize: true,
      synchronize: process.env.ENV === 'dev',  // Only synchronize in the 'dev' environment
    }),
    TypeOrmModule.forFeature([
      OB1AgentTools,
      OB1ToolCategory,
      OB1ToolExecutionLog
    ]), // Register the entities for repositories in your services
  ],
  exports: [TypeOrmModule],
})
export class PostgresOb1AgentServicesDbModule { }
