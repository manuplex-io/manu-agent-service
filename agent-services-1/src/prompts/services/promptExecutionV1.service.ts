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
import { v4 as uuid } from 'uuid';
import { OB1AgentTools } from 'src/tools/entities/ob1-agent-tools.entity';
import { trace } from 'console';


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
        //this.logger.log(`Inside validateVariables for ${variableType} : ${JSON.stringify(variables)}`);
        // Check if promptVariables is empty or undefined
        if (!promptVariables || Object.keys(promptVariables).length === 0) {
            this.logger.log(`No ${variableType} prompt variables defined for validation.`);
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

    private async sendToolLogToPortkey(logData: {
        request: {
            url?: string | 'url_unavailable'; // pseudo URL to identify the tool
            method?: string;  // defaults to 'POST'
            headers?: Record<string, string> | {};
            body: any;
        };
        response: {
            status?: number; //defaults to 200
            headers?: Record<string, string> | {};
            body: any;
            response_time: number;  //response latency
        };
        metadata: {
            traceId: string;
            spanId: string;
            spanName: string;
            parentSpanId?: string;
            additionalProperties?: string;
        };
    }): Promise<void> {
        //retrieve portkey from ENV (PORTKEY_API_KEY)
        const portkeyApiKey = process.env.PORTKEY_API_KEY;; // Replace with a secure fetch from config/env
        const url = 'https://api.portkey.ai/v1/logs';

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-portkey-api-key': portkeyApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData),
            });

            const jsonResponse = await res.json();
            this.logger.log('Tool log sent successfully to Portkey:', jsonResponse);
        } catch (err) {
            this.logger.error('Failed to send tool log to Portkey:', err);
        }
    }


    private async fetchAndValidateTools(toolIds: string[]): Promise<OB1LLM.Tool[]> {
        // Fetch tool information
        const toolsInfo = await this.toolsRepo.find({
            where: toolIds.map(toolId => ({ toolId })),
            select: [
                'toolId',
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
        const unavailableTools = toolsInfo.filter(tool => tool.toolStatus !== OB1Tool.ToolStatus.ACTIVE && tool.toolStatus !== OB1Tool.ToolStatus.DEPLOYED);
        if (unavailableTools.length > 0) {
            throw new BadRequestException(
                `Following tools are not available: ${unavailableTools.map(t => t.toolExternalName).join(', ')}`
            );
        }

        // Convert to LLM Tool format
        return toolsInfo.map(tool => ({
            toolId: tool.toolId,
            toolExternalName: tool.toolExternalName,
            toolDescription: tool.toolDescription,
            toolInputSchema: tool.toolInputSchema,
            toolOutputSchema: tool.toolOutputSchema
        }));
    }

    private async executeToolCall(Request: {
        toolCall: OB1LLM.ChatCompletionMessageToolCall,
        toolInputENVVariables?: Record<string, any>;
        toolInfo: OB1AgentTools,
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any }
    }
    ): Promise<OB1Tool.ToolResponse> {
        const toolRequest: OB1Tool.ToolRequest = {
            toolId: Request.toolInfo.toolId,
            toolInputVariables: JSON.parse(Request.toolCall.function.arguments), // Convert to an object 
            toolInputENVVariables: Request?.toolInputENVVariables,
            requestingServiceId: Request.requestMetadata?.sourceService || 'missing-SourceService'
        };

        this.logger.log(`Executing tool: ${Request.toolInfo.toolExternalName}`);

        try {
            const result: OB1Tool.ToolResponse = await Promise.race([
                this.toolExecutionV1Service.executeAnyTool(toolRequest),
                new Promise<OB1Tool.ToolResponse>((_, reject) =>
                    setTimeout(() => reject(new Error('Tool execution timeout')), Request.timeout)
                )
            ]);
            this.logger.log('Tool execution successful, result:', result);
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
        toolCalls: OB1LLM.ChatCompletionMessageToolCall[],
        toolInputENVVariables?: Record<string, any>;
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any }
    }): Promise<{
        newToolResults: Record<string, any>,
        toolCallLogs: OB1Tool.ToolCallLog[]
    }> {
        const toolCallLogs: OB1Tool.ToolCallLog[] = [];

        //this.logger.log(`3. Inside executeParallelToolCalls (straight): ${JSON.stringify(Request)}`);
        //this.logger.log(`3A. Inside executeParallelToolCalls:\n${JSON.stringify(Request, null, 2)}`);
        // First fetch all tool information
        const startToolsTime = Date.now();
        const toolsTracing = {
            traceId: Request.tracing.traceId,
            parentSpanId: Request.tracing.spanId,
            spanId: uuid(),
            spanName: `Tool Calls`,
            //additionalProperties: 'Tool execution logs'
        };

        Request.tracing.spanId = toolsTracing.spanId; // Update the spanId for the next level of tracing

        const toolsRequestMessages = {
            messages: [
                {
                    role: 'tool',
                    content: JSON.stringify(Request.toolCalls),
                    //tool_calls: Request.toolCalls.map(tc => tc.id)
                }
            ]
        };



        const toolExternalNames = [...new Set(Request.toolCalls.map(tc => tc.function.name))];
        //this.logger.log(`3B. Tool External Names: ${JSON.stringify(toolExternalNames)}`);
        const toolsInfoCollection = await this.toolsRepo.find({
            where: toolExternalNames.map(toolExternalName => ({ toolExternalName })),
            select: [
                'toolId',
                'toolExternalName',
            ]
        });

        //this.logger.log(`3C. Tools Info Collection: ${JSON.stringify(toolsInfoCollection, null, 2)}`);

        const eachToolresultsArray = await Promise.all(
            Request.toolCalls.map(async (toolCall) => {
                const toolInfo = toolsInfoCollection.find(t => t.toolExternalName === toolCall.function.name);
                if (!toolInfo) {
                    throw new NotFoundException(`Tool not found: ${toolCall.function.name}`);
                }



                const toolTracing = {
                    traceId: Request.tracing.traceId,
                    parentSpanId: Request.tracing.spanId,
                    spanId: uuid(),
                    spanName: `tool_execution_${toolInfo.toolExternalName}`,
                    additionalProperties: 'Tool execution logs'
                };


                const toolRequest = {
                    toolCall,
                    toolInputENVVariables: Request?.toolInputENVVariables,
                    toolInfo,
                    tracing: toolTracing,
                    timeout: Request.timeout,
                    requestMetadata: Request.requestMetadata
                };

                // declare a new toolRequestMessages array with role = tool, contant = toolRequest, tool_call_id = toolCall.id
                const toolRequestMessages = [
                    {
                        role: 'tool',
                        content: JSON.stringify(toolRequest),
                        tool_call_id: toolCall.id
                    }
                ];

                this.logger.log(`3D.Each toot Request: ${JSON.stringify(toolRequest, null, 2)}`);

                const startToolTime = Date.now();

                const result = await this.executeToolCall(toolRequest);

                // Add to toolCallLogs
                toolCallLogs.push({
                    toolName: toolInfo.toolExternalName,
                    toolInputArguments: JSON.parse(toolCall.function.arguments),
                    toolOutput: result.toolResult,
                    toolExecutionTime: result.toolExecutionTime,
                });

                const toolResponse = {
                    content: {
                        name: toolInfo.toolExternalName,
                        output: result.toolResult,
                        successful: result.toolSuccess,
                        error: result.toolResult?.error
                    },
                    tool_call_id: toolCall.id,
                    //arguments: toolCall.function.arguments,
                    //executionTime: result.toolExecutionTime,

                };
                //this.logger.log(`4. Every Tool response: ${JSON.stringify(toolResponse)}`);
                //this.logger.log(`4. Every Tool response:\n${JSON.stringify(toolResponse, null, 2)}`);

                // Log tool execution
                const responseTime = result.toolExecutionTime || (Date.now() - startToolTime);
                // Construct log data
                const logData = {
                    request: {
                        body: {
                            messages: toolRequestMessages
                        }
                    },
                    response: {   // @Need to Fix this, it does not pretty format like the master Tool call Log in Portkey
                        status: result.toolSuccess ? 200 : 500,
                        body: {
                            choices: [
                                {
                                    message: {
                                        role: 'tool',
                                        content: JSON.stringify(toolResponse),
                                        tool_calls: toolCall.id
                                    }
                                }]
                        },
                        response_time: responseTime
                    },
                    metadata: toolTracing,
                };

                // Send the tool log to Portkey
                await this.sendToolLogToPortkey(logData);

                return {
                    ...toolResponse
                };
            })
        );

        const toolsResponseMessages = {
            choices: [
                {
                    message: {
                        role: 'tool',
                        content: JSON.stringify(toolCallLogs),
                        tool_calls: toolCallLogs.map(tc => tc.toolName)
                    }
                }
            ]
        };

        // Log tool execution
        const toolsResponseTime = (Date.now() - startToolsTime);

        const ToolslogData = {
            request: {
                body: toolsRequestMessages
            },
            response: {
                status: 200,
                body: toolsResponseMessages,
                response_time: toolsResponseTime
            },
            metadata: toolsTracing,
        };

        // Send the tool log to Portkey
        await this.sendToolLogToPortkey(ToolslogData);

        // const newToolResults = eachToolresults.reduce((acc, eachToolresults) => {
        //     acc[eachToolresults.content.name] = eachToolresults;
        //     return acc;
        // }, {});

        return {
            newToolResults: eachToolresultsArray,
            toolCallLogs
        };
    }


    async executePromptBase(
        promptRequest: OB1Prompt.ExecutePromptGlobalBase,
    ): Promise<OB1LLM.LLMResponse> {
        const startTime = Date.now();
        let llmCallCount = 0;
        let toolCallCount = 0;
        // Array to store all tool calls for logging
        const allToolCallLogs: OB1Tool.ToolCallLog[] = [];  // Array to store all tool call logs
        // Get the prompt
        const prompt = promptRequest.prompt;
        const processedSystemPrompt = promptRequest.systemPrompt;
        const processedUserPrompt = promptRequest.userPrompt;
        let availableTools = null;

        if (promptRequest.availableTools && Object.keys(promptRequest.availableTools).length > 0) {
            availableTools = promptRequest.availableTools;
        }

        this.logger.log('Tool available: ' + JSON.stringify(promptRequest.availableTools));

        try {

            // Prepare initial LLM request
            const llmRequest: OB1LLM.LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                tracing: {
                    traceId: promptRequest.requestId,
                    spanId: `initial_llm_call`,
                    spanName: `initial_llm_call`
                    //parentSpanId: `initial_llm_call`

                },
                requestMetadata: promptRequest.requestMetadata,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...promptRequest.llmConfig,
                },
                ...availableTools && { inputTools: availableTools, },
                messageHistory : promptRequest.messageHistory
                //inputTools: availableTools,
            };
            this.logger.log(`1. LLM Request (check Tools):\n${JSON.stringify(llmRequest, null, 2)}`);

            // Add response format if specified
            if (prompt.promptResponseFormat) {
                llmRequest.response_format = prompt.promptResponseFormat;
            }

            let finalResponse: OB1LLM.LLMResponse;
            let toolResults: Record<string, any> = {};

            while (llmCallCount < (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
                this.logger.log(`1. Inside while loop, loop count: ${llmCallCount}`);
                // this.logger.log(`1. LLM Request: ${JSON.stringify(llmRequest)}`);
                this.logger.log(`1. LLM Request:\n${JSON.stringify(llmRequest, null, 2)}`);
                // Make LLM call
                llmCallCount++;
                const response = await this.llmV2Service.generateResponseWithStructuredOutputWithTools(llmRequest);

                // If no tool calls, return response
                if (!response.tool_calls?.length) {
                    this.logger.log(`No tool calls found in response: ${JSON.stringify(response)}, hence returning response`);
                    finalResponse = response;
                    break;
                }
                // If reached max tool calls, throw error
                if (toolCallCount >= (promptRequest.promptConfig?.maxToolCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_CALLS)) {
                    throw new BadRequestException({
                        message: `Max tool calls reached: ${toolCallCount}`,
                        partialResponse: response,
                    });
                }
                //this.logger.log(`2. Tool calls found in response: ${JSON.stringify(response.tool_calls)}, making calls`);
                //this.logger.log(`2. Tool calls found in response:\n${JSON.stringify(response.tool_calls, null, 2)}`);
                // Execute tool calls
                toolCallCount += response.tool_calls.length;
                const { newToolResults, toolCallLogs } = await this.executeParallelToolCalls({
                    toolCalls: response.tool_calls,
                    tracing: {
                        traceId: llmRequest.tracing.traceId,
                        spanId: llmRequest.tracing.spanId,
                    },
                    timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                    requestMetadata: promptRequest.requestMetadata,
                    toolInputENVVariables: promptRequest.toolInputENVVariables,
                }
                );
                toolResults = { ...toolResults, ...newToolResults };

                // Add new tool call logs to the main array
                allToolCallLogs.push(...toolCallLogs);

                // Remove systemPrompt and userPrompt from llmRequest since it already exists in messageHistory
                delete llmRequest.systemPrompt;
                delete llmRequest.userPrompt;
                llmRequest.tracing.parentSpanId = llmRequest.tracing.spanId;
                llmRequest.tracing.spanId = `llm_call_${llmCallCount}`;
                llmRequest.tracing.spanName = `followup_llm_call_${llmCallCount}_with_toolResults`;

                // add tool results to message history
                llmRequest.messageHistory = [
                    ...response.messageHistory,
                    ...newToolResults.map(toolResult => ({
                        role: 'tool',
                        content: JSON.stringify(toolResult),
                        tool_call_id: toolResult.tool_call_id
                    }))
                ];
                // If reached max LLM calls, throw error
                if (llmCallCount >= (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
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
                systemVariables: promptRequest.systemPromptVariables || { 'undefined': 'undefined' },
                userVariables: promptRequest.userPromptVariables || { 'undefined': 'undefined' },
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

    async executePromptWithoutUserPromptWithTools(
        promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        // Get the prompt
        const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
        }

        let availableTools = null;
        if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
            // Validate and fetch tools
            availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);
        }
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

        // Preparing request for Base
        const promptBaseRequest: OB1Prompt.ExecutePromptGlobalBase = {
            ...promptRequest,
            prompt: prompt,
            availableTools: availableTools,
            systemPrompt: processedSystemPrompt,
            userPrompt: processedUserPrompt,
            messageHistory:promptRequest.messageHistory
        };



        const Response = await this.executePromptBase(promptBaseRequest);
        return Response;

    }

    async executePromptWithUserPromptWithTools(
        promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        // Get the prompt
        const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
        }
        let availableTools = null;
        if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
            // Validate and fetch tools
            availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);
        }

        this.logger.log('Tool available: ' + JSON.stringify(availableTools));
        // Validate prompt status and variables
        if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
            throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
        }
        this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

        // Process prompts
        const processedSystemPrompt = this.interpolateVariables(
            prompt.systemPrompt,
            promptRequest.systemPromptVariables
        );
        const processedUserPrompt = promptRequest.userPrompt;

        // Preparing request for Base
        const promptBaseRequest: OB1Prompt.ExecutePromptGlobalBase = {
            ...promptRequest,
            prompt: prompt,
            availableTools: availableTools,
            systemPrompt: processedSystemPrompt,
            userPrompt: processedUserPrompt,
        };

        const Response = await this.executePromptBase(promptBaseRequest);
        return Response;

    }

}

//old code (delete later)

// async executePromptWithUserPromptNoToolExec(
//     promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
// ): Promise<OB1LLM.LLMResponse> {
//     const startTime = Date.now();
//     this.logger.log(`Inside executePromptWithUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

//     try {
//         // Get the prompt
//         const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
//         if (!prompt) {
//             throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
//         }
//         if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
//             throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
//         }

//         // Validate system variables
//         this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

//         // Process the system prompt
//         const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, promptRequest.systemPromptVariables);

//         // Prepare LLM request
//         const llmRequest: OB1LLM.LLMRequest = {
//             systemPrompt: processedSystemPrompt,
//             userPrompt: promptRequest.userPrompt,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata,
//             config: {
//                 ...prompt.promptDefaultConfig,
//                 ...promptRequest.llmConfig,
//             }
//         };

//         // Conditionally add response_format
//         if (prompt.promptResponseFormat) {
//             llmRequest.response_format = prompt.promptResponseFormat as OB1LLM.ResponseFormatJSONSchema;
//         }

//         // Execute the request
//         const response = await this.llmV2Service.generateResponseWithStructuredOutputNoTools(llmRequest);

//         // Log the execution
//         const executionTime = Date.now() - startTime;
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             llmConfig: llmRequest.config,
//             processedSystemPrompt,
//             processedUserPrompt: promptRequest.userPrompt,
//             response: response.content,
//             responseTime: executionTime,
//             tokenUsage: response.usage,
//             successful: true,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         // Update prompt statistics
//         await this.updatePromptStats(promptRequest.promptId, executionTime);

//         return response;

//     } catch (error) {
//         this.logger.error(`Error in executePromptWithUserPromptNoToolExec: ${error.message}`, error.stack);
//         // Log failed execution
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             llmConfig: promptRequest.llmConfig,
//             processedSystemPrompt: '',
//             processedUserPrompt: promptRequest.userPrompt,
//             response: '',
//             responseTime: Date.now() - startTime,
//             tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
//             successful: false,
//             errorMessage: error.message,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         throw error;
//     }
// }

// async executePromptWithoutUserPromptNoToolExec(
//     promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
// ): Promise<OB1LLM.LLMResponse> {
//     const startTime = Date.now();
//     this.logger.log(`Inside executePromptWithoutUserPromptNoToolExec: ${JSON.stringify(promptRequest)}`);

//     try {
//         // Get the prompt
//         const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
//         if (!prompt) {
//             throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
//         }
//         if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
//             throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
//         }

//         // Validate user and system variables
//         this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');
//         this.validateVariables(promptRequest.userPromptVariables, prompt.userPromptVariables, 'user');

//         //this.logger.log(`Prompt 1: ${JSON.stringify(prompt)}`);
//         //this.logger.log(`executePromptWithoutUserPromptNoToolExec:: promptRequest:\n${JSON.stringify(promptRequest, null, 2)}`);
//         // Process the system prompt
//         const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, promptRequest.systemPromptVariables);

//         // Process the user prompt
//         const processedUserPrompt = this.interpolateVariables(prompt.userPrompt, promptRequest.userPromptVariables);
//         this.logger.log(`Proceesed User prompt 2: ${JSON.stringify(processedUserPrompt)}`);

//         // Prepare LLM request
//         const llmRequest: OB1LLM.LLMRequest = {
//             systemPrompt: processedSystemPrompt,
//             userPrompt: processedUserPrompt,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata,
//             config: {
//                 ...prompt.promptDefaultConfig,
//                 ...promptRequest.llmConfig,
//             }
//         };

//         // Conditionally add response_format
//         if (prompt.promptResponseFormat) {
//             llmRequest.response_format = prompt.promptResponseFormat as OB1LLM.ResponseFormatJSONSchema;
//         }

//         this.logger.log(`LLM Request:\n${JSON.stringify(llmRequest, null, 2)}`);

//         // Execute the request
//         const response = await this.llmV2Service.generateResponseWithStructuredOutputNoTools(llmRequest);

//         // Log the execution
//         const executionTime = Date.now() - startTime;
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             userVariables: promptRequest.userPromptVariables,
//             llmConfig: llmRequest.config,
//             processedSystemPrompt,
//             processedUserPrompt,
//             response: response.content,
//             responseTime: executionTime,
//             tokenUsage: response.usage,
//             successful: true,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata

//         });

//         // Update prompt statistics
//         await this.updatePromptStats(promptRequest.promptId, executionTime);

//         return response;

//     } catch (error) {
//         // Log failed execution
//         //this.logger.error(`Error in executePromptWithoutUserPromptNoToolExec: ${error.message}`, error.stack);
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             userVariables: promptRequest.userPromptVariables,
//             llmConfig: promptRequest.llmConfig || { "config": "NOT PROVIDED" },
//             processedSystemPrompt: '',
//             processedUserPrompt: '',
//             response: '',
//             responseTime: Date.now() - startTime,
//             tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
//             successful: false,
//             errorMessage: error.message,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata

//         });

//         throw error;
//     }
// }

// async executePromptWithUserPromptWithToolExec(
//     promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
// ): Promise<OB1LLM.LLMResponse> {
//     const startTime = Date.now();
//     let llmCallCount = 0;
//     let toolCallCount = 0;
//     // Array to store all tool calls for logging
//     const allToolCallLogs: OB1Tool.ToolCallLog[] = [];  // Array to store all tool call logs

//     try {
//         // Get the prompt
//         const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
//         if (!prompt) {
//             throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
//         }
//         // Validate and fetch tools
//         const availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);


//         // Validate prompt status and variables
//         if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
//             throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
//         }
//         this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');

//         // Process system prompt
//         const processedSystemPrompt = this.interpolateVariables(
//             prompt.systemPrompt,
//             promptRequest.systemPromptVariables
//         );

//         // Prepare initial LLM request
//         const llmRequest: OB1LLM.LLMRequest = {
//             systemPrompt: processedSystemPrompt,
//             userPrompt: promptRequest.userPrompt,
//             tracing: {
//                 traceId: promptRequest.requestId,
//                 spanName: `initial_llm_call`
//             },
//             requestMetadata: promptRequest.requestMetadata,
//             config: {
//                 ...prompt.promptDefaultConfig,
//                 ...promptRequest.llmConfig,
//             },
//             inputTools: availableTools,
//         };

//         // Add response format if specified
//         if (prompt.promptResponseFormat) {
//             llmRequest.response_format = prompt.promptResponseFormat;
//         }

//         let finalResponse: OB1LLM.LLMResponse;
//         let toolResults: OB1Tool.ToolResponse;

//         while (llmCallCount < (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
//             // Make LLM call
//             llmCallCount++;
//             const response = await this.llmV2Service.generateResponseWithStructuredOutputWithTools(llmRequest);

//             // If no tool calls, return response
//             if (!response.tool_calls?.length) {
//                 finalResponse = response;
//                 break;
//             }
//             // If reached max tool calls, throw error
//             if (toolCallCount >= (promptRequest.promptConfig?.maxToolCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_CALLS)) {
//                 throw new BadRequestException({
//                     message: `Max tool calls reached: ${toolCallCount}`,
//                     partialResponse: response,
//                 });
//             }

//             // Execute tool calls
//             toolCallCount += response.tool_calls.length;
//             const { newToolResults, toolCallLogs } = await this.executeParallelToolCalls({
//                 toolCalls: response.tool_calls,
//                 toolInputENV: promptRequest?.promptInputENV,
//                 tracing: { traceId: promptRequest.requestId },
//                 timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
//                 requestMetadata: promptRequest.requestMetadata
//             }
//             );
//             toolResults = { ...toolResults, ...newToolResults };

//             // Add new tool call logs to the main array
//             allToolCallLogs.push(...toolCallLogs);

//             // Prepare next LLM request with tool results
//             llmRequest.messageHistory = [
//                 { role: 'assistant', content: response.content },
//                 { role: 'tool', content: JSON.stringify(newToolResults.content), tool_call_id: newToolResults.tool_call_id }
//             ];
//             // If reached max LLM calls, throw error
//             if (llmCallCount >= (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
//                 throw new BadRequestException({
//                     message: `Max LLM calls reached: ${llmCallCount}`,
//                     lastToolCallResult: toolResults,
//                     partialResponse: response,
//                 });
//             }
//         }

//         // Log execution
//         const executionTime = Date.now() - startTime;
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             llmConfig: llmRequest.config,
//             processedSystemPrompt,
//             processedUserPrompt: promptRequest.userPrompt,
//             response: finalResponse.content,
//             responseTime: executionTime,
//             tokenUsage: finalResponse.usage,
//             successful: true,
//             toolCalls: allToolCallLogs,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         await this.updatePromptStats(promptRequest.promptId, executionTime);
//         return finalResponse;

//     } catch (error) {
//         // Handle and log error
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             llmConfig: promptRequest.llmConfig,
//             processedSystemPrompt: '',
//             processedUserPrompt: promptRequest.userPrompt,
//             response: '',
//             responseTime: Date.now() - startTime,
//             tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
//             successful: false,
//             errorMessage: error.message,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         throw error;
//     }
// }

// async executePromptWithoutUserPromptWithToolExec(
//     promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
// ): Promise<OB1LLM.LLMResponse> {
//     const startTime = Date.now();
//     let llmCallCount = 0;
//     let toolCallCount = 0;
//     // Array to store all tool calls for logging
//     const allToolCallLogs: OB1Tool.ToolCallLog[] = [];  // Array to store all tool call logs

//     try {
//         // Get the prompt
//         const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
//         if (!prompt) {
//             throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
//         }
//         // Validate and fetch tools
//         const availableTools = await this.fetchAndValidateTools(prompt.promptAvailableTools);

//         // Validate prompt status and variables
//         if (prompt.promptStatus !== OB1Prompt.PromptStatus.ACTIVE) {
//             throw new BadRequestException(`Prompt is not active: ${promptRequest.promptId}`);
//         }
//         this.validateVariables(promptRequest.systemPromptVariables, prompt.systemPromptVariables, 'system');
//         this.validateVariables(promptRequest.userPromptVariables, prompt.userPromptVariables, 'user');

//         // Process prompts
//         const processedSystemPrompt = this.interpolateVariables(
//             prompt.systemPrompt,
//             promptRequest.systemPromptVariables
//         );
//         const processedUserPrompt = this.interpolateVariables(
//             prompt.userPrompt,
//             promptRequest.userPromptVariables
//         );

//         // Prepare initial LLM request
//         const llmRequest: OB1LLM.LLMRequest = {
//             systemPrompt: processedSystemPrompt,
//             userPrompt: processedUserPrompt,
//             tracing: {
//                 traceId: promptRequest.requestId,
//                 spanId: `initial_llm_call`,
//                 spanName: `initial_llm_call`
//                 //parentSpanId: `initial_llm_call`

//             },
//             requestMetadata: promptRequest.requestMetadata,
//             config: {
//                 ...prompt.promptDefaultConfig,
//                 ...promptRequest.llmConfig,
//             },
//             inputTools: availableTools,
//         };

//         // Add response format if specified
//         if (prompt.promptResponseFormat) {
//             llmRequest.response_format = prompt.promptResponseFormat;
//         }

//         let finalResponse: OB1LLM.LLMResponse;
//         let toolResults: Record<string, any> = {};

//         while (llmCallCount < (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
//             this.logger.log(`1. Inside while loop, loop count: ${llmCallCount}`);
//             // this.logger.log(`1. LLM Request: ${JSON.stringify(llmRequest)}`);
//             this.logger.log(`1. LLM Request:\n${JSON.stringify(llmRequest, null, 2)}`);
//             // Make LLM call
//             llmCallCount++;
//             const response = await this.llmV2Service.generateResponseWithStructuredOutputWithTools(llmRequest);

//             // If no tool calls, return response
//             if (!response.tool_calls?.length) {
//                 this.logger.log(`No tool calls found in response: ${JSON.stringify(response)}, hence returning response`);
//                 finalResponse = response;
//                 break;
//             }
//             // If reached max tool calls, throw error
//             if (toolCallCount >= (promptRequest.promptConfig?.maxToolCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_CALLS)) {
//                 throw new BadRequestException({
//                     message: `Max tool calls reached: ${toolCallCount}`,
//                     partialResponse: response,
//                 });
//             }
//             //this.logger.log(`2. Tool calls found in response: ${JSON.stringify(response.tool_calls)}, making calls`);
//             this.logger.log(`2. Tool calls found in response:\n${JSON.stringify(response.tool_calls, null, 2)}`);
//             // Execute tool calls
//             toolCallCount += response.tool_calls.length;
//             const { newToolResults, toolCallLogs } = await this.executeParallelToolCalls({
//                 toolCalls: response.tool_calls,
//                 tracing: {
//                     traceId: llmRequest.tracing.traceId,
//                     spanId: llmRequest.tracing.spanId,
//                 },
//                 timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
//                 requestMetadata: promptRequest.requestMetadata
//             }
//             );
//             toolResults = { ...toolResults, ...newToolResults };

//             // Add new tool call logs to the main array
//             allToolCallLogs.push(...toolCallLogs);

//             // Remove systemPrompt and userPrompt from llmRequest since it already exists in messageHistory
//             delete llmRequest.systemPrompt;
//             delete llmRequest.userPrompt;
//             llmRequest.tracing.parentSpanId = llmRequest.tracing.spanId;
//             llmRequest.tracing.spanId = `llm_call_${llmCallCount}`;
//             llmRequest.tracing.spanName = `followup_llm_call_${llmCallCount}_with_toolResults`;

//             // add tool results to message history
//             llmRequest.messageHistory = [
//                 ...response.messageHistory,
//                 ...newToolResults.map(toolResult => ({
//                     role: 'tool',
//                     content: JSON.stringify(toolResult),
//                     tool_call_id: toolResult.tool_call_id
//                 }))
//             ];
//             // If reached max LLM calls, throw error
//             if (llmCallCount >= (promptRequest.promptConfig?.maxLLMCalls || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_LLM_CALLS)) {
//                 throw new BadRequestException({
//                     message: `Max LLM calls reached: ${llmCallCount}`,
//                     lastToolCallResult: toolResults,
//                     partialResponse: response,
//                 });
//             }
//         }

//         // Log execution
//         const executionTime = Date.now() - startTime;
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             userVariables: promptRequest.userPromptVariables,
//             llmConfig: llmRequest.config,
//             processedSystemPrompt,
//             processedUserPrompt,
//             response: finalResponse.content,
//             responseTime: executionTime,
//             tokenUsage: finalResponse.usage,
//             successful: true,
//             toolCalls: allToolCallLogs,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         await this.updatePromptStats(promptRequest.promptId, executionTime);
//         return finalResponse;

//     } catch (error) {
//         // Handle and log error
//         await this.logExecution({
//             promptId: promptRequest.promptId,
//             systemVariables: promptRequest.systemPromptVariables,
//             userVariables: promptRequest.userPromptVariables,
//             llmConfig: promptRequest.llmConfig,
//             processedSystemPrompt: '',
//             processedUserPrompt: '',
//             response: '',
//             responseTime: Date.now() - startTime,
//             tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
//             successful: false,
//             errorMessage: error.message,
//             tracing: { traceId: promptRequest.requestId },
//             requestMetadata: promptRequest.requestMetadata
//         });

//         throw error;
//     }
// }
