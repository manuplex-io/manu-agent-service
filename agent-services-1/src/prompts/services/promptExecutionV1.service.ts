// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1AgentPromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { LLMV2Service } from '../../llms/services/llmV2.service';
import { ToolsExecutionV1Service } from '../../tools/services/toolsExecutionV1.service';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { OB1Prompt } from '../interfaces/prompt.interface';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';
import { v5 as uuid } from 'uuid';
import { OB1AgentTools } from 'src/tools/entities/ob1-agent-tools.entity';


@Injectable()
export class PromptExecutionV1Service {
    private readonly logger = new Logger(PromptExecutionV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1AgentPromptExecutionLog) private executionLogRepo: Repository<OB1AgentPromptExecutionLog>,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        private readonly llmV2Service: LLMV2Service,
        private readonly toolExecutionV1Service: ToolsExecutionV1Service,
    ) { }


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

    private async logExecution(logData: Partial<OB1AgentPromptExecutionLog>): Promise<void> {
        const log = this.executionLogRepo.create(logData);
        await this.executionLogRepo.save(log);
    }

    private async updatePromptStats(promptId: string, executionTime: number): Promise<void> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }

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
    ): Promise<{ logs: OB1AgentPromptExecutionLog[]; total: number }> {
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
        promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        const startTime = Date.now();
        this.logger.log(`Inside executePromptWithUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

        try {
            // Get the prompt
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
            if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
            }

            // Validate system variables
            this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

            // Process the system prompt
            const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, promptRequest.systemPromptVariables);

            // Prepare LLM request
            const llmRequest: OB1LLM.LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: promptRequest.userPrompt,
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                }
            };

            // Conditionally add response_format
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat as OB1LLM.ResponseFormatJSONSchema;
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
                tracing: { traceId: promptRequest.requestId },
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
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata
            });

            throw error;
        }
    }

    async executePromptWithoutUserPromptNoToolExec(
        promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        const startTime = Date.now();
        this.logger.log(`Inside executePromptWithoutUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

        try {
            // Get the prompt
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
            if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
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
            const llmRequest: OB1LLM.LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                }
            };

            // Conditionally add response_format
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat as OB1LLM.ResponseFormatJSONSchema;
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
                tracing: { traceId: promptRequest.requestId },
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
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata

            });

            throw error;
        }
    }


    // private async executeParallelToolCalls(
    //     toolCalls: OB1LLM.ToolCallResult[],
    //     tracing: OB1LLM.promptTracing,
    //     timeout: number
    // ): Promise<Record<string, any>> {
    //     const results = await Promise.all(
    //         toolCalls.map(async (toolCall) => {
    //             const toolTracing = {
    //                 ...tracing,
    //                 spanId: uuid(),
    //                 parentSpanId: tracing.spanId,
    //                 spanName: `tool_execution_${toolCall.name}`,
    //                 startTime: Date.now()
    //             };

    //             try {
    //                 const result = await Promise.race([
    //                     this.toolExecutionV1Service.executeTool(toolCall.name, toolCall.arguments, toolTracing),
    //                     new Promise((_, reject) =>
    //                         setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
    //                     )
    //                 ]);

    //                 return {
    //                     name: toolCall.name,
    //                     arguments: toolCall.arguments,
    //                     output: result,
    //                     successful: true
    //                 };
    //             } catch (error) {
    //                 return {
    //                     name: toolCall.name,
    //                     arguments: toolCall.arguments,
    //                     error: error.message,
    //                     successful: false
    //                 };
    //             }
    //         })
    //     );

    //     return results.reduce((acc, result) => {
    //         acc[result.name] = result;
    //         return acc;
    //     }, {});
    // }

    private async fetchAndValidateTools(toolIds: string[]): Promise<OB1LLM.Tool[]> {
        // Fetch tool information
        const toolsInfo = await this.toolsRepo.find({
            where: toolIds.map(toolId => ({ toolId })),
            select: [
                'toolId',
                'toolName',
                'toolExternalName',
                'toolDescription',
                'toolInputSchema',
                'toolOutputSchema',
                'toolStatus',
                'toolUsageQuota'
            ]
        });

        // Validate that all requested tools were found
        if (toolsInfo.length !== toolIds.length) {
            const foundToolIds = toolsInfo.map(tool => tool.toolId);
            const missingTools = toolIds.filter(id => !foundToolIds.includes(id));
            throw new NotFoundException(`Tools not found: ${missingTools.join(', ')}`);
        }

        // Validate tool status
        const unavailableTools = toolsInfo.filter(tool => tool.toolStatus !== OB1Tool.ToolStatus.ACTIVE);
        if (unavailableTools.length > 0) {
            throw new BadRequestException(
                `Following tools are not available: ${unavailableTools.map(t => t.toolName).join(', ')}`
            );
        }

        // Convert to LLM Tool format
        return toolsInfo.map(tool => ({
            toolId: tool.toolId,
            toolName: tool.toolName,
            toolDescription: tool.toolDescription,
            toolInputSchema: tool.toolInputSchema,
            toolOutputSchema: tool.toolOutputSchema
        }));
    }

    private async executeToolCall(Request: {
        toolCall: OB1LLM.ToolCall,
        toolInfo: OB1AgentTools,
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any }
    }
    ): Promise<OB1Tool.ToolResponse> {
        const toolRequest: OB1Tool.ToolRequest = {
            toolId: Request.toolInfo.toolId,
            toolInput: Request.toolCall.arguments,
            requestingServiceId: Request.requestMetadata?.sourceService || 'missing-SourceService'
        };

        try {
            const result: OB1Tool.ToolResponse = await Promise.race([
                this.toolExecutionV1Service.executeAnyTool(toolRequest),
                new Promise<OB1Tool.ToolResponse>((_, reject) =>
                    setTimeout(() => reject(new Error('Tool execution timeout')), Request.timeout)
                )
            ]);

            return result;
        } catch (error) {
            this.logger.error(`Tool execution failed: ${error.message}`, error.stack);
            return {
                toolSuccess: false,
                toolResult: { error: error.message },
                toolExecutionTime: 0
            };
        }
    }



    private async executeParallelToolCalls(Request: {
        toolCalls: OB1LLM.ToolCall[],
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any }
    }): Promise<{
        newToolResults: Record<string, any>,
        toolCallLogs: OB1Tool.ToolCallLog[]
    }> {
        const toolCallLogs: OB1Tool.ToolCallLog[] = [];

        // First fetch all tool information
        const toolIds = [...new Set(Request.toolCalls.map(tc => tc.name))];
        const toolsInfo = await this.toolsRepo.find({
            where: toolIds.map(toolId => ({ toolId }))
        });

        const results = await Promise.all(
            Request.toolCalls.map(async (toolCall) => {
                const toolInfo = toolsInfo.find(t => t.toolId === toolCall.name);
                if (!toolInfo) {
                    throw new NotFoundException(`Tool not found: ${toolCall.name}`);
                }

                const toolTracing = {
                    ...Request.tracing,
                    spanId: uuid(),
                    parentSpanId: Request.tracing.spanId,
                    spanName: `tool_execution_${toolInfo.toolName}`,
                    startTime: Date.now()
                };

                const result = await this.executeToolCall({
                    toolCall,
                    toolInfo,
                    tracing: toolTracing,
                    timeout: Request.timeout,
                    requestMetadata: Request.requestMetadata
                });

                // Add to toolCallLogs
                toolCallLogs.push({
                    toolName: toolInfo.toolName,
                    toolInputArguments: toolCall.arguments,
                    toolOutput: result.toolResult
                });

                return {
                    name: toolInfo.toolName,
                    arguments: toolCall.arguments,
                    output: result.toolResult,
                    successful: result.toolSuccess,
                    executionTime: result.toolExecutionTime,
                };
            })
        );

        const newToolResults = results.reduce((acc, result) => {
            acc[result.name] = result;
            return acc;
        }, {});

        return {
            newToolResults,
            toolCallLogs
        };
    }
    // private async executeParallelToolCalls(Request: {
    //     toolCalls: OB1LLM.ToolCall[],
    //     tracing: OB1LLM.promptTracing,
    //     timeout: number,
    //     requestMetadata: { [key: string]: any }
    // }
    // ): Promise<Record<string, any>> {

    //     const toolCallLogs: Array<{
    //         toolName: string;
    //         ToolInputArguments: Record<string, any>;
    //         toolOutput: any;
    //     }> = [];

    //     // First fetch all tool information
    //     const toolIds = [...new Set(Request.toolCalls.map(tc => tc.name))];
    //     const toolsInfo = await this.toolsRepo.find({
    //         where: toolIds.map(toolId => ({ toolId }))
    //     });

    //     const results = await Promise.all(
    //         Request.toolCalls.map(async (toolCall) => {
    //             const toolInfo = toolsInfo.find(t => t.toolId === toolCall.name);
    //             if (!toolInfo) {
    //                 throw new NotFoundException(`Tool not found: ${toolCall.name}`);
    //             }

    //             const toolTracing = {
    //                 ...Request.tracing,
    //                 spanId: uuid(),
    //                 parentSpanId: Request.tracing.spanId,
    //                 spanName: `tool_execution_${toolInfo.toolName}`,
    //                 startTime: Date.now()
    //             };

    //             const result = await this.executeToolCall({
    //                 toolCall,
    //                 toolInfo,
    //                 tracing: toolTracing,
    //                 timeout: Request.timeout,
    //                 requestMetadata: Request.requestMetadata
    //             }
    //             );

    //             return {
    //                 name: toolInfo.toolName,
    //                 arguments: toolCall.arguments,
    //                 output: result.toolResult,
    //                 successful: result.toolSuccess,
    //                 executionTime: result.toolExecutionTime,
    //             };
    //         })
    //     );

    //     return results.reduce((acc, result) => {
    //         acc[result.name] = result;
    //         return acc;
    //     }, {});
    // }

    async executePromptWithUserPromptWithToolExec(
        promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        const startTime = Date.now();
        let llmCallCount = 0;
        let toolCallCount = 0;
        // Array to store all tool calls for logging
        const allToolCallLogs: OB1Tool.ToolCallLog[] = [];  // Array to store all tool call logs

        try {
            // Get the prompt
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
            // Validate and fetch tools
            const availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);


            // Validate prompt status and variables
            if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
            }
            this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

            // Process system prompt
            const processedSystemPrompt = this.interpolateVariables(
                prompt.systemPrompt,
                promptRequest.systemPromptVariables
            );

            // Prepare initial LLM request
            const llmRequest: OB1LLM.LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: promptRequest.userPrompt,
                tracing: {
                    traceId: promptRequest.requestId,
                    spanName: 'initial_llm_call'
                },
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                },
                inputTools: availableTools,
            };

            // Add response format if specified
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat;
            }

            let finalResponse: OB1LLM.LLMResponse;
            let toolResults: OB1Tool.ToolResponse;

            while (llmCallCount < (promptRequest.promptConfig.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
                // Make LLM call
                llmCallCount++;
                const response = await this.llmV2Service.generateResponseWithStructuredOutputWithTools(llmRequest);

                // If no tool calls, return response
                if (!response.toolCalls?.length) {
                    finalResponse = response;
                    break;
                }
                // If reached max tool calls, throw error
                if (toolCallCount >= (promptRequest.promptConfig.maxToolCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_CALLS)) {
                    throw new BadRequestException({
                        message: `Max tool calls reached: ${toolCallCount}`,
                        partialResponse: response,
                    });
                }

                // Execute tool calls
                toolCallCount += response.toolCalls.length;
                const { newToolResults, toolCallLogs } = await this.executeParallelToolCalls({
                    toolCalls: response.toolCalls,
                    tracing: { traceId: promptRequest.requestId },
                    timeout: promptRequest.promptConfig.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                    requestMetadata: promptRequest.requestMetadata
                }
                );
                toolResults = { ...toolResults, ...newToolResults };

                // Add new tool call logs to the main array
                allToolCallLogs.push(...toolCallLogs);

                // Prepare next LLM request with tool results
                llmRequest.messageHistory = [
                    { role: 'assistant', content: response.content },
                    { role: 'system', content: JSON.stringify(newToolResults) }
                ];
                // If reached max LLM calls, throw error
                if (llmCallCount >= (promptRequest.promptConfig.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
                    throw new BadRequestException({
                        message: `Max LLM calls reached: ${llmCallCount}`,
                        lastToolCallResult: toolResults,
                        partialResponse: response,
                    });
                }
            }

            // Log execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt: promptRequest.userPrompt,
                response: finalResponse.content,
                responseTime: executionTime,
                tokenUsage: finalResponse.usage,
                successful: true,
                toolCalls: allToolCallLogs,
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata
            });

            await this.updatePromptStats(promptRequest.promptId, executionTime);
            return finalResponse;

        } catch (error) {
            // Handle and log error
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
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata
            });

            throw error;
        }
    }

    async executePromptWithoutUserPromptWithToolExec(
        promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        const startTime = Date.now();
        let llmCallCount = 0;
        let toolCallCount = 0;
        // Array to store all tool calls for logging
        const allToolCallLogs: OB1Tool.ToolCallLog[] = [];  // Array to store all tool call logs

        try {
            // Get the prompt
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
            // Validate and fetch tools
            const availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);

            // Validate prompt status and variables
            if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
            }
            this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');
            this.validateVariables(promptRequest.userPromptVariables, prompt.userPromptVariables, 'user');

            // Process prompts
            const processedSystemPrompt = this.interpolateVariables(
                prompt.systemPrompt,
                promptRequest.systemPromptVariables
            );
            const processedUserPrompt = this.interpolateVariables(
                prompt.userPrompt,
                promptRequest.userPromptVariables
            );

            // Prepare initial LLM request
            const llmRequest: OB1LLM.LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                tracing: {
                    traceId: promptRequest.requestId,
                    spanName: 'initial_llm_call'
                },
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                },
                inputTools: availableTools,
            };

            // Add response format if specified
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat;
            }

            let finalResponse: OB1LLM.LLMResponse;
            let toolResults: Record<string, any> = {};

            while (llmCallCount < (promptRequest.promptConfig.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
                // Make LLM call
                llmCallCount++;
                const response = await this.llmV2Service.generateResponseWithStructuredOutputWithTools(llmRequest);

                // If no tool calls, return response
                if (!response.toolCalls?.length) {
                    finalResponse = response;
                    break;
                }
                // If reached max tool calls, throw error
                if (toolCallCount >= (promptRequest.promptConfig.maxToolCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_CALLS)) {
                    throw new BadRequestException({
                        message: `Max tool calls reached: ${toolCallCount}`,
                        partialResponse: response,
                    });
                }

                // Execute tool calls
                toolCallCount += response.toolCalls.length;
                const { newToolResults, toolCallLogs } = await this.executeParallelToolCalls({
                    toolCalls: response.toolCalls,
                    tracing: { traceId: promptRequest.requestId },
                    timeout: promptRequest.promptConfig.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                    requestMetadata: promptRequest.requestMetadata
                }
                );
                toolResults = { ...toolResults, ...newToolResults };

                // Add new tool call logs to the main array
                allToolCallLogs.push(...toolCallLogs);

                // Prepare next LLM request with tool results
                llmRequest.messageHistory = [
                    { role: 'assistant', content: response.content },
                    { role: 'system', content: JSON.stringify(newToolResults) }
                ];
                // If reached max LLM calls, throw error
                if (llmCallCount >= (promptRequest.promptConfig.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
                    throw new BadRequestException({
                        message: `Max LLM calls reached: ${llmCallCount}`,
                        lastToolCallResult: toolResults,
                        partialResponse: response,
                    });
                }
            }

            // Log execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                userVariables: promptRequest.userPromptVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt,
                response: finalResponse.content,
                responseTime: executionTime,
                tokenUsage: finalResponse.usage,
                successful: true,
                toolCalls: allToolCallLogs,
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata
            });

            await this.updatePromptStats(promptRequest.promptId, executionTime);
            return finalResponse;

        } catch (error) {
            // Handle and log error
            await this.logExecution({
                promptId: promptRequest.promptId,
                systemVariables: promptRequest.systemPromptVariables,
                userVariables: promptRequest.userPromptVariables,
                llmConfig: promptRequest.llmConfig,
                processedSystemPrompt: '',
                processedUserPrompt: '',
                response: '',
                responseTime: Date.now() - startTime,
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                successful: false,
                errorMessage: error.message,
                tracing: { traceId: promptRequest.requestId },
                requestMetadata: promptRequest.requestMetadata
            });

            throw error;
        }
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