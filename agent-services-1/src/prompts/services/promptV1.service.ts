// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1PromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { LLMV2Service } from '../../llms/services/llmV2.service';
import { LLMRequest, LLMResponse, ResponseFormatJSONSchema } from '../../llms/interfaces/llmV2.interfaces';
import {
    PromptStatus,
    ExecutePromptWithUserPromptNoToolExec,
    ExecutePromptWithoutUserPromptNoToolExec,
} from '../interfaces/prompt.interfaces';
import { generateDefaultErrorMessageResponseValue } from '../../kafka-ob1/interfaces/ob1-message.interfaces';

@Injectable()
export class PromptV1Service {
    private readonly logger = new Logger(PromptV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1PromptExecutionLog) private executionLogRepo: Repository<OB1PromptExecutionLog>,
        private readonly llmV2Service: LLMV2Service
    ) { }

    async createPrompt(promptData: Partial<OB1AgentPrompts>): Promise<OB1AgentPrompts> {
        const prompt = this.promptsRepo.create(promptData);
        return await this.promptsRepo.save(prompt);
    }

    async updatePrompt(promptId: string, promptData: Partial<OB1AgentPrompts>): Promise<OB1AgentPrompts> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }

        Object.assign(prompt, promptData);
        return await this.promptsRepo.save(prompt);
    }

    async getPrompt(promptId: string): Promise<OB1AgentPrompts> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }
        return prompt;
    }

    async listPrompts(filters: {
        status?: PromptStatus;
        category?: string;
        search?: string;
    } = {}): Promise<OB1AgentPrompts[]> {
        const query = this.promptsRepo.createQueryBuilder('prompt');

        if (filters.status) {
            query.andWhere('prompt.promptStatus = :status', { status: filters.status });
        }

        if (filters.category) {
            query.andWhere('prompt.category = :category', { category: filters.category });
        }

        if (filters.search) {
            query.andWhere(
                '(prompt.promptName ILIKE :search OR prompt.promptDescription ILIKE :search)',
                { search: `%${filters.search}%` }
            );
        }

        return await query.getMany();
    }

    private interpolateVariables(template: string, variables: Record<string, any>): string {
        return template.replace(/\${(\w+)}/g, (match, key) => {
            if (variables.hasOwnProperty(key)) {
                return variables[key];
            }
            throw new BadRequestException(`Missing required variable: ${key}`);
        });
    }

    // Helper function to validate variables
    private validateVariables(
        variables: Record<string, any> = {}, // Default to an empty object
        promptVariables: Record<string, any> = {}, // Default to an empty object
        variableType: string,
    ) {
        this.logger.log(`Inside validateVariables: ${JSON.stringify(variables)}`);
        // Check if promptVariables is empty or undefined
        if (!promptVariables || Object.keys(promptVariables).length === 0) {
            this.logger.warn(`No ${variableType} prompt variables defined for validation.`);
            return; // Skip validation
        }

        for (const [key, config] of Object.entries(promptVariables)) {
            // Check if required variable is missing
            if (config.required && !variables.hasOwnProperty(key)) {
                throw new BadRequestException(`Missing required ${variableType} prompt variable: ${key}`);
            }

            // Check if the type matches the expected type
            if (config.required) {
                const expectedType = config.type;
                const actualValue = variables[key];
                const actualType = typeof actualValue;

                if (actualValue === undefined || actualValue === null) {
                    throw new BadRequestException(
                        `Required ${variableType} variable "${key}" is defined but has no value (undefined or null).`
                    );
                }

                if (actualType !== expectedType) {
                    throw new BadRequestException(
                        `Invalid type for ${variableType} variable "${key}": expected ${expectedType}, but received ${actualType}`
                    );
                }
            }
        }
    }




    private async logExecution(logData: Partial<OB1PromptExecutionLog>): Promise<void> {
        const log = this.executionLogRepo.create(logData);
        await this.executionLogRepo.save(log);
    }

    private async updatePromptStats(promptId: string, executionTime: number): Promise<void> {
        const prompt = await this.getPrompt(promptId);

        // Update execution count and average response time
        const newCount = prompt.promptExecutionCount + 1;
        const newAvgTime = ((prompt.promptAvgResponseTime * prompt.promptExecutionCount) + executionTime) / newCount;

        await this.promptsRepo.update(promptId, {
            promptExecutionCount: newCount,
            promptAvgResponseTime: newAvgTime
        });
    }

    async getExecutionLogs(
        promptId: string,
        filters: {
            startDate?: Date;
            endDate?: Date;
            successful?: boolean;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ logs: OB1PromptExecutionLog[]; total: number }> {
        const query = this.executionLogRepo.createQueryBuilder('log')
            .where('log.promptId = :promptId', { promptId });

        if (filters.startDate) {
            query.andWhere('log.executedAt >= :startDate', { startDate: filters.startDate });
        }

        if (filters.endDate) {
            query.andWhere('log.executedAt <= :endDate', { endDate: filters.endDate });
        }

        if (filters.successful !== undefined) {
            query.andWhere('log.successful = :successful', { successful: filters.successful });
        }

        const total = await query.getCount();

        query.orderBy('log.executedAt', 'DESC')
            .limit(filters.limit || 10)
            .offset(filters.offset || 0);

        const logs = await query.getMany();

        return { logs, total };
    }

    async executePromptWithUserPromptNoToolExec(
        promptRequest: ExecutePromptWithUserPromptNoToolExec,
    ): Promise<LLMResponse> {
        const startTime = Date.now();
        this.logger.log(`Inside executePromptWithUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

        try {
            // Get the prompt
            const prompt = await this.getPrompt(promptRequest.promptId);
            if (prompt.promptStatus !== PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
            }

            // Validate system variables
            this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

            // Process the system prompt
            const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, promptRequest.systemPromptVariables);

            // Prepare LLM request
            const llmRequest: LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: promptRequest.userPrompt,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                }
            };

            // Conditionally add response_format
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat as ResponseFormatJSONSchema;
            }

            // Execute the request
            const response = await this.llmV2Service.generateResponseWithStructuredOutputNoTools(llmRequest);

            // Log the execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt: promptRequest.userPrompt,
                response: response.content,
                responseTime: executionTime,
                tokenUsage: response.usage,
                successful: true,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata
            });

            // Update prompt statistics
            await this.updatePromptStats(promptRequest.promptId, executionTime);

            return response;

        } catch (error) {
            this.logger.error(`Error in executePromptWithUserPromptNoToolExec: ${error.message}`, error.stack);
            // Log failed execution
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                llmConfig: promptRequest.llmConfig,
                processedSystemPrompt: '',
                processedUserPrompt: promptRequest.userPrompt,
                response: '',
                responseTime: Date.now() - startTime,
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                successful: false,
                errorMessage: error.message,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata
            });

            throw error;
        }
    }

    async executePromptWithoutUserPromptNoToolExec(
        promptRequest: ExecutePromptWithoutUserPromptNoToolExec,
    ): Promise<LLMResponse> {
        const startTime = Date.now();
        this.logger.log(`Inside executePromptWithoutUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

        try {
            // Get the prompt
            const prompt = await this.getPrompt(promptRequest.promptId);
            if (prompt.promptStatus !== PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
            }

            // Validate user and system variables
            this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');
            this.validateVariables(promptRequest.userPromptVariables, prompt.userPromptVariables, 'user');

            //this.logger.log(`Prompt 1: ${JSON.stringify(prompt)}`);
            //this.logger.log(`executePromptWithoutUserPromptNoToolExec:: promptRequest:\n${JSON.stringify(promptRequest, null, 2)}`);
            // Process the system prompt
            const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, promptRequest.systemPromptVariables);

            // Process the user prompt
            const processedUserPrompt = this.interpolateVariables(prompt.userPrompt, promptRequest.userPromptVariables);


            // Prepare LLM request
            const llmRequest: LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                },
                messageHistory:promptRequest.messageHistory,
            };

            // Conditionally add response_format
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat as ResponseFormatJSONSchema;
            }

            this.logger.log(`LLM Request:\n${JSON.stringify(llmRequest, null, 2)}`);

            // Execute the request
            const response = await this.llmV2Service.generateResponseWithStructuredOutputNoTools(llmRequest);

            // Log the execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                userVariables: promptRequest.userPromptVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt,
                response: response.content,
                responseTime: executionTime,
                tokenUsage: response.usage,
                successful: true,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata

            });

            // Update prompt statistics
            await this.updatePromptStats(promptRequest.promptId, executionTime);

            return response;

        } catch (error) {
            // Log failed execution
            //this.logger.error(`Error in executePromptWithoutUserPromptNoToolExec: ${error.message}`, error.stack);
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                userVariables: promptRequest.userPromptVariables,
                llmConfig: promptRequest.llmConfig || { "config": "NOT PROVIDED" },
                processedSystemPrompt: '',
                processedUserPrompt: '',
                response: '',
                responseTime: Date.now() - startTime,
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                successful: false,
                errorMessage: error.message,
                tracing: promptRequest.tracing,
                requestMetadata: promptRequest.requestMetadata

            });

            throw error;
        }
    }
    // @Post('generate-with-tools')
    // async generateWithTools(
    //     @Body(new ValidationPipe({ transform: true })) request: LLMRequest,
    // ): Promise<LLMResponse> {
    //     // If no tools specified in config or non-OpenAI provider, use regular generation
    //     if (!request.config.tools?.length || request.config.provider !== LLMProvider.OPENAI) {
    //         return this.llmService.generateResponse(request);
    //     }

    //     try {
    //         // Fetch tool information
    //         const toolsInfo = await this.toolsRepo.find({
    //             where: request.config.tools.map(toolId => ({ toolId })),
    //             select: [
    //                 'toolId',
    //                 'toolName',
    //                 'toolDescription',
    //                 'inputSchema',
    //                 'outputSchema',
    //                 'toolStatus',
    //             ]
    //         });

    //         // Validate that all requested tools were found
    //         if (toolsInfo.length !== request.config.tools.length) {
    //             const foundToolIds = toolsInfo.map(tool => tool.toolId);
    //             const missingTools = request.config.tools.filter(id => !foundToolIds.includes(id));
    //             throw new NotFoundException(`Tools not found: ${missingTools.join(', ')}`);
    //         }

    //         // Validate tool status
    //         const unavailableTools = toolsInfo.filter(tool => tool.toolStatus !== 'active');
    //         if (unavailableTools.length > 0) {
    //             throw new BadRequestException(
    //                 `Following tools are not available: ${unavailableTools.map(t => t.toolName).join(', ')}`
    //             );
    //         }

    //         // Get initial response with potential tool calls
    //         const response = await this.llmService.generateResponseWithTools(request, toolsInfo);

    //         // If no tool was called, return the response as is
    //         if (!response.toolCalls?.length) {
    //             return response;
    //         }

    //         // Execute the tool call
    //         const toolCall = response.toolCalls[0];
    //         const tool = toolsInfo.find(t => t.toolName === toolCall.name);

    //         if (!tool) {
    //             throw new NotFoundException(`Tool not found: ${toolCall.name}`);
    //         }

    //         const reqHeaders = response.reqHeaders;

    //         try {
    //             // Execute the tool
    //             const toolResult = await this.pythonLambdaService.invokeLambda(
    //                 tool.toolId,
    //                 toolCall.arguments
    //             );

    //             // Get final response incorporating the tool result
    //             return await this.llmService.generateFinalResponseWithToolResult(
    //                 request,
    //                 toolsInfo,
    //                 {
    //                     ...toolCall,
    //                     output: toolResult
    //                 },
    //                 reqHeaders
    //             );
    //         } catch (error) {
    //             // Handle tool execution errors
    //             this.logger.error(`Tool execution failed: ${error.message}`, error.stack);
    //             throw new BadRequestException(`Tool execution failed: ${error.message}`);
    //         }
    //     } catch (error) {
    //         // Rethrow validation and not found errors
    //         if (error instanceof BadRequestException || error instanceof NotFoundException) {
    //             throw error;
    //         }
    //         // Log and wrap other errors
    //         this.logger.error(`Error in generate-with-tools: ${error.message}`, error.stack);
    //         throw new BadRequestException(`Failed to process request: ${error.message}`);
    //     }
    // }
}