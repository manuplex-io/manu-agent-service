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

import { PromptService } from '../services/prompt.service';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { LLMResponse, } from '../../llms/interfaces/llm.interfaces';
import { CreatePromptDto, UpdatePromptDto, ListPromptsQueryDto, ExecutePromptDto, ExecutionLogsQueryDto } from '../interfaces/prompt.interfaces';




@Controller('prompts')
export class PromptController {
    constructor(private readonly promptService: PromptService) { }

    @Post()
    async createPrompt(
        @Body(new ValidationPipe({ transform: true })) createPromptDto: CreatePromptDto
    ): Promise<OB1AgentPrompts> {
        return await this.promptService.createPrompt(createPromptDto);
    }

    @Put(':promptId')
    async updatePrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) updatePromptDto: UpdatePromptDto
    ): Promise<OB1AgentPrompts> {
        return await this.promptService.updatePrompt(promptId, updatePromptDto);
    }

    @Get(':promptId')
    async getPrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string
    ): Promise<OB1AgentPrompts> {
        return await this.promptService.getPrompt(promptId);
    }

    @Get()
    async listPrompts(
        @Query(new ValidationPipe({ transform: true })) query: ListPromptsQueryDto
    ): Promise<OB1AgentPrompts[]> {
        return await this.promptService.listPrompts(query);
    }

    @Post(':promptId/execute')
    async executePrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) executeDto: ExecutePromptDto
    ): Promise<LLMResponse> {
        return await this.promptService.executePrompt(
            promptId,
            executeDto.userPrompt,
            executeDto.userVariables,
            executeDto.systemVariables,
            executeDto.llmConfig
        );
    }

    @Post(':promptId/executewithoutUserPrompt')
    async executewithoutUserPrompt(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Body(new ValidationPipe({ transform: true })) executeDto: ExecutePromptDto
    ): Promise<LLMResponse> {
        return await this.promptService.executewithoutUserPrompt(
            promptId,
            executeDto.userVariables,
            executeDto.systemVariables,
            executeDto.llmConfig
        );
    }

    @Get(':promptId/logs')
    async getExecutionLogs(
        @Param('promptId', ParseUUIDPipe) promptId: string,
        @Query(new ValidationPipe({ transform: true })) query: ExecutionLogsQueryDto
    ) {
        return await this.promptService.getExecutionLogs(promptId, query);
    }
}