import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PythonLambdaService } from './services/python-lambda.service';
import { ToolTestingController } from './controllers/tool-testing.controller';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1ToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import { OB1ToolExecutionLog } from '../entities/ob1-agent-toolExecutionLog.entity';
import { PostgresOb1AgentServicesDbModule } from '../postgres-ob1-agentServices-db/postgres-ob1-agentServices-db.module';

@Module({
    imports: [
        PostgresOb1AgentServicesDbModule,
        TypeOrmModule.forFeature([
            OB1AgentTools,
            OB1ToolCategory,
            OB1ToolExecutionLog
        ])
    ],
    controllers: [ToolTestingController],
    providers: [PythonLambdaService],
    exports: [PythonLambdaService] // Export if you need to use it in other modules
})
export class ToolsModule { }