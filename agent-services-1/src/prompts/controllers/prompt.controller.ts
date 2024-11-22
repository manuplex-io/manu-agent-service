// src/prompts/controllers/prompt.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    ValidationPipe,
    ParseUUIDPipe,
    ParseBoolPipe,
    ParseIntPipe,
    BadRequestException
} from '@nestjs/common';

import { PromptV1Service } from '../services/promptV1.service';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { LLMResponse, } from '../../llms/interfaces/llmV2.interfaces';
import {
    CreatePromptDto,
    UpdatePromptDto,
    ListPromptsQueryDto,
    ExecutePromptwithoutUserPromptDto,
    ExecutePromptwithUserPromptDto,
    ExecutePromptWithUserPromptNoToolExec,
    ExecutePromptWithoutUserPromptNoToolExec,
    ExecutionLogsQueryDto
} from '../interfaces/prompt.interfaces';
import { trace } from 'console';




@Controller('prompts')
export class PromptController {
    constructor(
        private readonly promptV1Service: PromptV1Service
    ) { }

    @Post()
    async createPrompt(
        @Body(new ValidationPipe({ transform: true })) createPromptDto: CreatePromptDto
    ): Promise<OB1AgentPrompts> {
        return await this.promptV1Service.createPrompt(createPromptDto);
    }

    @Put(':promptId')
    async updatePrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) updatePromptDto: UpdatePromptDto
    ): Promise<OB1AgentPrompts> {
        return await this.promptV1Service.updatePrompt(promptId, updatePromptDto);
    }

    @Get(':promptId')
    async getPrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string
    ): Promise<OB1AgentPrompts> {
        return await this.promptV1Service.getPrompt(promptId);
    }

    @Get()
    async listPrompts(
        @Query(new ValidationPipe({ transform: true })) query: ListPromptsQueryDto
    ): Promise<OB1AgentPrompts[]> {
        return await this.promptV1Service.listPrompts(query);
    }

    @Post(':promptId/executewithUserPrompt')
    async executePrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) executeDto: ExecutePromptwithUserPromptDto
    ): Promise<LLMResponse> {
        const tracing = { "traceId": `PROMPT-CONTR-${Date.now()}` };
        const requestMetadata = { "sourceFunction": "executePromptwithUserPrompt" };
        const request: ExecutePromptWithUserPromptNoToolExec = {
            promptId,
            userPrompt: executeDto.userPrompt,
            systemPromptVariables: executeDto.systemPromptVariables,
            llmConfig: executeDto.llmConfig,
            tracing,
            requestMetadata,
        };

        return await this.promptV1Service.executePromptWithUserPromptNoToolExec(
            request
        );
    }



    @Post(':promptId/executewithoutUserPrompt')
    async executewithoutUserPrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) executeDto: ExecutePromptwithoutUserPromptDto
    ): Promise<LLMResponse> {
        const tracing = { "traceId": `PROMPT-CONTR-${Date.now()}` };
        const requestMetadata = { "sourceFunction": "executePromptwithoutUserPrompt" };
        const request: ExecutePromptWithoutUserPromptNoToolExec = {
            promptId,
            userPromptVariables: executeDto.userPromptVariables,
            systemPromptVariables: executeDto.systemPromptVariables,
            llmConfig: executeDto.llmConfig,
            tracing,
            requestMetadata
        };
        return await this.promptV1Service.executePromptWithoutUserPromptNoToolExec(
            request
        );
    }

    @Get(':promptId/logs')
    async getExecutionLogs(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Query(new ValidationPipe({ transform: true })) query: ExecutionLogsQueryDto
    ) {
        return await this.promptV1Service.getExecutionLogs(promptId, query);
    }
}