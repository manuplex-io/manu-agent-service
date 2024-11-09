// src/tools/controllers/tool-testing.controller.ts

import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PythonLambdaService } from '../services/python-lambda.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OB1AgentTools } from 'src/tools/entities/ob1-agent-tools.entity';
import { OB1ToolExecutionLog } from 'src/tools/entities/ob1-agent-toolExecutionLog.entity';

@Controller('tool-testing')
export class ToolTestingController {
    constructor(
        private readonly pythonLambdaService: PythonLambdaService,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        @InjectRepository(OB1ToolExecutionLog) private executionLogRepo: Repository<OB1ToolExecutionLog>,
    ) { }

    @Get('tools')
    async listTools() {
        return await this.toolsRepo.find({
            relations: ['category']
        });
    }

    @Post('deploy/:toolId')
    async deployTool(@Param('toolId') toolId: string) {
        const startTime = Date.now();
        try {
            const functionName = await this.pythonLambdaService.deployLambda(toolId);
            return { success: true, functionName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    @Post('test/:toolId')
    async testTool(
        @Param('toolId') toolId: string,
        @Body() input: any
    ) {
        const startTime = Date.now();
        const tool = await this.toolsRepo.findOne({ where: { toolId: toolId } });

        if (!tool) {
            throw new Error('Tool not found');
        }

        try {
            // Execute the tool
            const result = await this.pythonLambdaService.invokeLambda(toolId, input);

            // Log the execution
            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                agentId: 'test-user',
                input,
                output: result,
                success: true,
                executionTime,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.avgExecutionTime = ((tool.avgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            tool.toolSuccessRate = ((tool.toolSuccessRate * (tool.toolUseCount - 1)) + 1) / tool.toolUseCount;
            await this.toolsRepo.save(tool);

            return {
                success: true,
                executionTime,
                result
            };
        } catch (error) {
            // Log the failed execution
            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                agentId: 'test-user',
                input,
                success: false,
                errorMessage: error.message,
                executionTime,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.avgExecutionTime = ((tool.avgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            tool.toolSuccessRate = (tool.toolSuccessRate * (tool.toolUseCount - 1)) / tool.toolUseCount;
            await this.toolsRepo.save(tool);

            return {
                success: false,
                executionTime,
                error: error.message
            };
        }
    }
}
