// /src/postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module.ts

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
// tools
import { OB1AgentTools } from '../../tools/entities/ob1-agent-tools.entity';
import { OB1AgentToolCategory } from '../../tools/entities/ob1-agent-toolCategory.entity';
import { OB1AgentToolExecutionLog } from 'src/tools/entities/ob1-agent-toolExecutionLog.entity';
// prompts
import { OB1AgentPrompts } from 'src/prompts/entities/ob1-agent-prompts.entity';
import { OB1AgentPromptExecutionLog } from 'src/prompts/entities/ob1-agent-promptExecutionLog.entity';
import { OB1AgentPromptCategory } from 'src/prompts/entities/ob1-agent-promptCategory.entity';
// workflows
import { OB1AgentWorkflows } from '../../workflows/entities/ob1-agent-workflows.entity';
import { OB1AgentWorkflowCategory } from '../../workflows/entities/ob1-agent-workflowCategory.entity';
import { OB1AgentWorkflowExecutionLog } from '../../workflows/entities/ob1-agent-workflowExecutionLog.entity';
import { OB1AgentWorkflowActivities } from '../../workflows/entities/ob1-agent-workflowActivities.entity';
// activitys
import { OB1AgentActivities } from '../../activity/entities/ob1-agent-activities.entity';
import { OB1AgentActivityCategory } from '../../activity/entities/ob1-agent-activityCategory.entity';
import { OB1AgentActivityExecution } from '../../activity/entities/ob1-agent-activityExecutionLog.entity';
// RAG
// import { OB1AgentRags } from '../../rags/entities/ob1-agent-rags.entity';


@Global() //no need to import this module in other modules
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // This will make .env configurations accessible throughout the app
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isLocalEnv = ['local', 'localhost'].includes(process.env.ENV);
        const isDevEnv = process.env.ENV === 'dev';
        const isProdEnv = process.env.ENV === 'prod';
        return {
          type: 'postgres',
          host: process.env.OB1_DB_HOST,
          port: +process.env.OB1_DB_PORT,
          database: process.env.OB1_DB_DATABASE_AGENTSERVICE || 'ob1-agentServices-db',
          username: isLocalEnv
            ? process.env.OB1_DB_USERNAME_AGENTSERVICE_LOCAL
            : isDevEnv
              ? process.env.OB1_DB_USERNAME_AGENTSERVICE_DEV
              : process.env.OB1_DB_USERNAME_AGENTSERVICE,
          password: isLocalEnv
            ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_LOCAL
            : isDevEnv
              ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_DEV
              : process.env.OB1_DB_PASSWORD_AGENTSERVICE,
          entities: [
            OB1AgentTools,
            OB1AgentToolCategory,
            OB1AgentToolExecutionLog,
            OB1AgentPrompts,
            OB1AgentPromptCategory,
            OB1AgentPromptExecutionLog,
            OB1AgentWorkflows,
            OB1AgentWorkflowCategory,
            OB1AgentWorkflowExecutionLog,
            OB1AgentWorkflowActivities,
            OB1AgentActivities,
            OB1AgentActivityCategory,
            OB1AgentActivityExecution,
          ], // Add the entities relevant to this DB
          // synchronize: isLocalEnv || isDevEnv, // Synchronize only in 'local', 'localhost', or 'dev' environments
          synchronize: true, // Synchronize only in 'local', 'localhost', or 'dev' environments
        };
      },
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options);
        await dataSource.initialize();

        // Assign the initialized DataSource globally for use in BeforeInsert hooks
        OB1AgentWorkflows.setDataSource(dataSource);
        OB1AgentActivities.setDataSource(dataSource);
        OB1AgentTools.setDataSource(dataSource);
        OB1AgentPrompts.setDataSource(dataSource);
        return dataSource;
      },
    }),
    // TypeOrmModule.forRootAsync({
    //   name: 'vectorDb',
    //   useFactory: () => {
    //     const isLocalEnv = ['local', 'localhost'].includes(process.env.ENV);
    //     const isDevEnv = process.env.ENV === 'dev';
    //     const isProdEnv = process.env.ENV === 'prod';

    //     return {
    //       type: 'postgres',
    //       host: process.env.OB1_VECTOR_DB_HOST,
    //       port: +process.env.OB1_DB_PORT,
    //       database: process.env.OB1_DB_DATABASE_AGENTSERVICE || 'ob1-agentServices-db',
    //       username: isLocalEnv
    //         ? process.env.OB1_DB_USERNAME_AGENTSERVICE_LOCAL
    //         : isDevEnv
    //           ? process.env.OB1_DB_USERNAME_AGENTSERVICE_DEV
    //           : process.env.OB1_DB_USERNAME_AGENTSERVICE,
    //       password: isLocalEnv
    //         ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_LOCAL
    //         : isDevEnv
    //           ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_DEV
    //           : process.env.OB1_DB_PASSWORD_AGENTSERVICE,
    //       entities: [
    //         OB1AgentRags,
    //       ],
    //       synchronize: false
    //     };
    //   },
    //   dataSourceFactory: async (options) => {
    //     const dataSource = new DataSource(options);
    //     // Add vector type if needed for second database
    //     // @ts-ignore
    //     dataSource.driver.supportedDataTypes.push('vector');
    //     await dataSource.initialize();

    //     OB1AgentRags.setDataSource(dataSource);
    //     return dataSource;
    //   },
    // }),
    TypeOrmModule.forFeature([
      OB1AgentTools,
      OB1AgentToolCategory,
      OB1AgentToolExecutionLog,
      OB1AgentPrompts,
      OB1AgentPromptCategory,
      OB1AgentPromptExecutionLog,
      OB1AgentWorkflows,
      OB1AgentWorkflowCategory,
      OB1AgentWorkflowExecutionLog,
      OB1AgentWorkflowActivities,
      OB1AgentActivities,
      OB1AgentActivityCategory,
      OB1AgentActivityExecution,
    ]), // Register the entities for repositories in your services
    // TypeOrmModule.forFeature(
    //   [OB1AgentRags],
    //   'vectorDb'
    // ),
  ],
  exports: [TypeOrmModule],
})
export class PostgresOb1AgentServicesDbModule { }