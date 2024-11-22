// src/tools/controllers/tool-testing.controller.ts

import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { ToolsExecutionV1Service } from '../services/toolsExecutionV1.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OB1AgentTools } from 'src/tools/entities/ob1-agent-tools.entity';
import { OB1ToolExecutionLog } from 'src/tools/entities/ob1-agent-toolExecutionLog.entity';
import { ToolRequest, ToolResponse } from 'src/tools/interfaces/tools.interface';

@Controller('tool-testing')
export class ToolTestingController {
    constructor(
        private readonly toolsExecutionV1Service: ToolsExecutionV1Service,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        @InjectRepository(OB1ToolExecutionLog) private executionLogRepo: Repository<OB1ToolExecutionLog>,
    ) { }


    @Post('deploy/:toolId')
    async deployTool(@Param('toolId') toolId: string) {
        const startTime = Date.now();
        try {
            const functionName = await this.toolsExecutionV1Service.deployTool(toolId);
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

        const toolRequest: ToolRequest = {
            toolId,
            toolInput: input,
            requestingServiceId: 'API test/:toolId',
        };

        const response = await this.toolsExecutionV1Service.executeTool(toolRequest);
        return response;
    }
}
