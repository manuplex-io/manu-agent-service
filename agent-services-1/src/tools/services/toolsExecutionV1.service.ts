// src/tools/services/tools-management.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1ToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import { OB1ToolExecutionLog } from '../entities/ob1-agent-toolExecutionLog.entity';
import { PythonLambdaV1Service } from './toolSpecificService/pythonLambdaV1.service';
import {
    ToolRequest,
    ToolResponse,
    ToolType,
    ToolPythonRequest,
    ToolPythonResponse,
    CreateToolDto,
    UpdateToolDto,
    CreateCategoryDto,
    UpdateCategoryDto,
    ToolResponseDto,
    ServiceResponse,
    ToolStatus,
    ToolQueryParams,
    PaginatedResponse,
    ToolUpdateResult
} from '../interfaces/tools.interface';
import { Tool } from '@anthropic-ai/sdk/resources';

@Injectable()
export class ToolsExecutionV1Service {
    constructor(
        private readonly pythonLambdaV1Service: PythonLambdaV1Service,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        @InjectRepository(OB1ToolCategory) private categoryRepository: Repository<OB1ToolCategory>,
        @InjectRepository(OB1ToolExecutionLog) private executionLogRepo: Repository<OB1ToolExecutionLog>,
    ) { }

    async deployTool(toolId: string): Promise<string> {
        const tool = await this.toolsRepo.findOne({ where: { toolId } });
        if (!tool) {
            throw new NotFoundException('Tool not found');
        }

        if (tool.toolType !== ToolType.PYTHON_SCRIPT) {
            throw new BadRequestException('Tool type not supported');
        }

        return this.pythonLambdaV1Service.deployLambda(toolId);
    }

    async executeTool(toolRequest: ToolRequest): Promise<ToolResponse> {

        const retrievedTool = await this.toolsRepo.findOne({ where: { toolId: toolRequest.toolId } });

        if (!retrievedTool) {
            throw new Error('Tool not found');
        }


        if (retrievedTool.toolType === ToolType.PYTHON_SCRIPT) {
            const toolPythonRequest: ToolPythonRequest = {
                tool: retrievedTool,
                toolInput: toolRequest.toolInput,
                requestingServiceId: toolRequest.requestingServiceId
            };
            return this.executePythonTool(toolPythonRequest);
        } else {
            throw new Error('Tool type not supported');
        }
    }



    async executePythonTool(toolPythonRequest: ToolPythonRequest): Promise<ToolPythonResponse> {
        const tool = toolPythonRequest.tool;
        // const input = toolPythonRequest.toolInput;
        const startTime = Date.now();


        try {
            // Execute the tool
            const toolOutput = await this.pythonLambdaV1Service.invokeLambda(tool.toolId, toolPythonRequest.toolInput);

            // Log the execution
            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                requestingServiceId: toolPythonRequest.requestingServiceId,
                toolInput: toolPythonRequest.toolInput,
                toolOutput,
                toolSuccess: true,
                toolExecutionTime: executionTime,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.toolAvgExecutionTime = ((tool.toolAvgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            tool.toolSuccessRate = ((tool.toolSuccessRate * (tool.toolUseCount - 1)) + 1) / tool.toolUseCount;
            await this.toolsRepo.save(tool);

            return {
                toolSuccess: true,
                toolExecutionTime: executionTime,
                toolresult: toolOutput
            };
        } catch (error) {
            // Log the failed execution
            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                requestingServiceId: toolPythonRequest.requestingServiceId,
                toolInput: toolPythonRequest.toolInput,
                toolOutput: error,
                toolSuccess: false,
                toolExecutionTime: executionTime,
                toolErrorMessage: error.message,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.toolAvgExecutionTime = ((tool.toolAvgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            tool.toolSuccessRate = (tool.toolSuccessRate * (tool.toolUseCount - 1)) / tool.toolUseCount;
            await this.toolsRepo.save(tool);

            return {
                toolresult: error,
                toolSuccess: false,
                toolExecutionTime: executionTime,
                toolError: error
            };
        }
    }

}