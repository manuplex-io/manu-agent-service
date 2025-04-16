// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1AgentPromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { PromptExecutionValidationV1Service } from './validation/promptExecutionValidationV1.service';
import { PromptWorkflowExecutionV1Service } from './execution/promptWorkflowExecutionV1.service';
import { PromptToolExecutionV1Service } from './execution/promptToolExecutionV1.service';
import { PromptActivityExecutionV1Service } from './execution/promptActivityExecutionV1.service';
import { PromptLogV1Service } from './log/promptLogV1.service';
import { LLMV2Service } from '../../llms/services/llmV2.service';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { OB1Prompt } from '../interfaces/prompt.interface';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';


@Injectable()
export class PromptExecutionV1Service {
    private readonly logger = new Logger(PromptExecutionV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1AgentPromptExecutionLog) private executionLogRepo: Repository<OB1AgentPromptExecutionLog>,
        private readonly llmV2Service: LLMV2Service,
        private readonly promptExecutionValidationV1Service: PromptExecutionValidationV1Service,
        private readonly promptWorkflowExecutionV1Service: PromptWorkflowExecutionV1Service,
        private readonly promptToolExecutionV1Service: PromptToolExecutionV1Service,
        private readonly promptActivityExecutionV1Service: PromptActivityExecutionV1Service,
        private readonly promptLogV1Service: PromptLogV1Service
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

                const toolToolCalls = response.tool_calls?.filter(tc => 
                    promptRequest.availableToolSet?.has(tc.function.name)
                ) || [];

                const activityToolCalls = response.tool_calls?.filter(tc => 
                    promptRequest.availableActivitySet?.has(tc.function.name)
                ) || [];
                
                const workflowToolCalls = response.tool_calls?.filter(tc => 
                    promptRequest.availableWorkflowSet?.has(tc.function.name)
                ) || [];
                //this.logger.log(`2. Tool calls found in response: ${JSON.stringify(response.tool_calls)}, making calls`);
                //this.logger.log(`2. Tool calls found in response:\n${JSON.stringify(response.tool_calls, null, 2)}`);
                // Execute tool calls
                toolCallCount += response.tool_calls.length;
                let messageHistory = [
                    ...(response.messageHistory || [])
                ];

                if (toolToolCalls.length > 0) {
                    const { newToolResults, toolCallLogs } = await this.promptToolExecutionV1Service.executeParallelToolCalls({
                        toolCalls: toolToolCalls,
                        tracing: {
                            traceId: llmRequest.tracing.traceId,
                            spanId: llmRequest.tracing.spanId,
                        },
                        timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                        requestMetadata: promptRequest.requestMetadata,
                        toolENVInputVariables: promptRequest.toolENVInputVariables,
                    });
                    toolResults = { ...toolResults, ...newToolResults };
                    // toolResultsForLLMMessage = Array.isArray(newToolResults) ? newToolResults : 
                    //                          (newToolResults ? [newToolResults] : []);
                    allToolCallLogs.push(...toolCallLogs);
                    messageHistory = [
                        ...messageHistory,
                        ...newToolResults.map(toolResult => ({
                            role: 'tool' as const,
                            content: JSON.stringify(toolResult || {}),
                            tool_call_id: toolResult?.tool_call_id || 'unknown'
                        }))
                    ];
                }
                // if (activityToolCalls.length > 0) {
                //     const { newToolResults, toolCallLogs } = await this.promptActivityExecutionV1Service.executeParallelActivityCalls({
                //         toolCalls: activityToolCalls,
                //         tracing: {
                //             traceId: llmRequest.tracing.traceId,
                //             spanId: llmRequest.tracing.spanId,
                //         },
                //         timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                //         requestMetadata: promptRequest.requestMetadata,
                //         toolENVInputVariables: promptRequest.activityENVInputVariables,
                //         consultantOrgShortName: promptRequest?.consultantOrgShortName,
                //         personId: promptRequest?.personId,
                //     });
                //     toolResults = { ...toolResults, ...newToolResults };
                //     // workflowResultsForLLMMessage = Array.isArray(newToolResults) ? newToolResults :
                //     //                              (newToolResults ? [newToolResults] : []);
                //     allToolCallLogs.push(...toolCallLogs);
                //     messageHistory = [
                //         ...messageHistory,
                //         ...newToolResults.map(toolResult => ({
                //             role: 'tool' as const,
                //             content: JSON.stringify(toolResult || {}),
                //             tool_call_id: toolResult?.tool_call_id || 'unknown'
                //         }))
                //     ];
                // }

                // if (workflowToolCalls.length > 0) {
                //     const { newToolResults, toolCallLogs } = await this.promptWorkflowExecutionV1Service.executeParallelWorkflowCalls({
                //         toolCalls: workflowToolCalls,
                //         tracing: {
                //             traceId: llmRequest.tracing.traceId,
                //             spanId: llmRequest.tracing.spanId,
                //         },
                //         timeout: promptRequest.promptConfig?.toolTimeout || OB1Prompt.DefaultPromptConfig.DEFAULT_MAX_TOOL_EXECUTION_TIME,
                //         requestMetadata: promptRequest.requestMetadata,
                //         toolENVInputVariables: promptRequest.workflowENVInputVariables,
                //         consultantOrgShortName: promptRequest?.consultantOrgShortName,
                //         personId: promptRequest?.personId,
                //     });
                //     toolResults = { ...toolResults, ...newToolResults };
                //     // workflowResultsForLLMMessage = Array.isArray(newToolResults) ? newToolResults :
                //     //                              (newToolResults ? [newToolResults] : []);
                //     allToolCallLogs.push(...toolCallLogs);
                //     messageHistory = [
                //         ...messageHistory,
                //         ...newToolResults.map(toolResult => ({
                //             role: 'tool' as const,
                //             content: JSON.stringify(toolResult || {}),
                //             tool_call_id: toolResult?.tool_call_id || 'unknown'
                //         }))
                //     ];
                // }

                llmRequest.messageHistory = messageHistory;

                // Remove systemPrompt and userPrompt from llmRequest since it already exists in messageHistory
                delete llmRequest.systemPrompt;
                delete llmRequest.userPrompt;
                llmRequest.tracing.parentSpanId = llmRequest.tracing.spanId;
                llmRequest.tracing.spanId = `llm_call_${llmCallCount}`;
                llmRequest.tracing.spanName = `followup_llm_call_${llmCallCount}_with_toolResults`;

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
            await this.promptLogV1Service.logExecution({
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

            // Add validation step before returning
            if (prompt.validationRequired) {
                const validationScore = await this.promptExecutionValidationV1Service.validateResponse({
                    originalPrompts: {
                        systemPrompt: processedSystemPrompt,
                        userPrompt: processedUserPrompt
                    },
                    toolCallHistory: allToolCallLogs,
                    finalResponse: finalResponse.content,
                    tracing: llmRequest.tracing,
                    requestMetadata: promptRequest.requestMetadata
                });
                // if (!validationScore.passed) {
                //     throw new BadRequestException({
                //         message: 'Response validation failed',
                //         validationScore,
                //         originalResponse: finalResponse
                //     });
                // }

                finalResponse.validationPassed = validationScore.passed;
                // Attach validation results to response metadata
                finalResponse.validationResults = JSON.stringify(validationScore);
            }

            return finalResponse;

        } catch (error) {
            // Handle and log error
            await this.promptLogV1Service.logExecution({
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
        try {
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
    
            // Initialize as empty array
            let availableTools: OB1LLM.Tool[] = [];
            const validationRequired = prompt.validationRequired || false;
            const validationGate = prompt.validationGate || false;
            let validationGateRetry = 0;
            // Create sets to track external names
            const availableToolSet = new Set<string>();
            const availableActivitySet = new Set<string>();
            const availableWorkflowSet = new Set<string>();
            
            // Add tools if available
            if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
                const tools = await this.promptToolExecutionV1Service.fetchAndValidateTools(prompt.promptAvailableTools);
                availableTools = [...availableTools, ...tools];
                // Add tool external names to set
                tools.forEach(tool => availableToolSet.add(tool.toolExternalName));
            }
    
            // Add activities if available
            if (prompt.promptAvailableActivities && Object.keys(prompt.promptAvailableActivities).length > 0) {
                const activities = await this.promptActivityExecutionV1Service.fetchAndValidateActivities(prompt.promptAvailableActivities);
                availableTools = [...availableTools, ...activities];
                // Add activity external names to set
                activities.forEach(activity => availableActivitySet.add(activity.toolExternalName));
            }
    
            // Add workflows if available
            if (prompt.promptAvailableWorkflows && Object.keys(prompt.promptAvailableWorkflows).length > 0) {
                const workflows = await this.promptWorkflowExecutionV1Service.fetchAndValidateWorkflows(prompt.promptAvailableWorkflows);
                availableTools = [...availableTools, ...workflows];
                // Add workflow external names to set
                workflows.forEach(workflow => availableWorkflowSet.add(workflow.toolExternalName));
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
                messageHistory:promptRequest.messageHistory,
                availableToolSet,
                availableActivitySet,
                availableWorkflowSet,
            };
    
            // If validation gate is not required, execute once and return
            if (!validationGate) {
                return await this.executePromptBase(promptBaseRequest);
            }
    
            // If validation gate is required, try multiple times
            let lastResponse = null;
            while (validationGateRetry < OB1Prompt.DefaultPromptConfig.DEFAULT_VALIDATION_GATE_RETRY) {
                this.logger.log(`Validation gate retry: ${validationGateRetry}`);
                lastResponse = await this.executePromptBase(promptBaseRequest);
                
                // Check if validation results exist and passed
                if (lastResponse?.validationPassed) {
                    return lastResponse;
                }
                validationGateRetry++;
            }
    
            // If we get here, validation failed after all retries
            throw new BadRequestException({
                message: 'Response validation failed after all retry attempts',
                validationScore: lastResponse?.validationResults,
                originalResponse: lastResponse
            });
        }catch(error){
            throw new BadRequestException({
                message: 'Prompt execution with user prompt failed',
                errorSuperDetails: { ...error },
            });
        }
    }

    async executePromptWithUserPromptWithTools(
        promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
    ): Promise<OB1LLM.LLMResponse> {
        // Get the prompt
        try{
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
            // Initialize as empty array
            let availableTools: OB1LLM.Tool[] = [];
            
            const validationRequired = prompt.validationRequired || false;
            const validationGate = prompt.validationGate || false;
            let validationGateRetry = 0;
            // Create sets to track external names
            const availableToolSet = new Set<string>();
            const availableActivitySet = new Set<string>();
            const availableWorkflowSet = new Set<string>();
            
            // Add tools if available
            if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
                const tools = await this.promptToolExecutionV1Service.fetchAndValidateTools(prompt.promptAvailableTools);
                availableTools = [...availableTools, ...tools];
                // Add tool external names to set
                tools.forEach(tool => availableToolSet.add(tool.toolExternalName));
            }

            // Add activities if available
            if (prompt.promptAvailableActivities && Object.keys(prompt.promptAvailableActivities).length > 0) {
                const activities = await this.promptActivityExecutionV1Service.fetchAndValidateActivities(prompt.promptAvailableActivities);
                availableTools = [...availableTools, ...activities];
                // Add activity external names to set
                activities.forEach(activity => availableActivitySet.add(activity.toolExternalName));
            }

            // Add workflows if available
            if (prompt.promptAvailableWorkflows && Object.keys(prompt.promptAvailableWorkflows).length > 0) {
                const workflows = await this.promptWorkflowExecutionV1Service.fetchAndValidateWorkflows(prompt.promptAvailableWorkflows);
                availableTools = [...availableTools, ...workflows];
                // Add workflow external names to set
                workflows.forEach(workflow => availableWorkflowSet.add(workflow.toolExternalName));
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
                availableToolSet,
                availableActivitySet,
                availableWorkflowSet,
            };

            if (!validationGate || !validationRequired) {
                return await this.executePromptBase(promptBaseRequest);
            }

            let lastResponse = null;
            while (validationGateRetry < OB1Prompt.DefaultPromptConfig.DEFAULT_VALIDATION_GATE_RETRY) {
                this.logger.log(`Validation gate retry: ${validationGateRetry}`);
                lastResponse = await this.executePromptBase(promptBaseRequest);
                if (lastResponse?.validationPassed) {
                    return lastResponse;
                }
                validationGateRetry++;
            }

            throw new BadRequestException({
                message: 'Response validation failed after all retry attempts',
                validationScore: lastResponse?.validationResults,
                originalResponse: lastResponse
            });
        }catch(error){
            throw new BadRequestException({
                message: 'Prompt execution with user prompt failed',
                errorSuperDetails: { ...error },
            });
        }
    }

    async executePromptWithUserPromptWithToolsAsync(
        promptRequest: OB1Prompt.ExecutePromptWithUserPrompt,
    ): Promise<OB1Prompt.ExecutePromptResponseAsync> {
        // Create response object immediately
        const responseAsync: OB1Prompt.ExecutePromptResponseAsync = {
            requestId: promptRequest.requestId,
            requestMetadata: promptRequest.requestMetadata,
            requestorId: promptRequest.personId,
        };

        // Start processing in background without awaiting
        Promise.resolve().then(async () => {
            try {
                // Get the prompt
                const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
                if (!prompt) {
                    throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
                }

                // Initialize as empty array
                let availableTools: OB1LLM.Tool[] = [];
                const validationRequired = prompt.validationRequired || false;
                const validationGate = prompt.validationGate || false;
                let validationGateRetry = 0;
                // Create sets to track external names
                const availableToolSet = new Set<string>();
                const availableActivitySet = new Set<string>();
                const availableWorkflowSet = new Set<string>();
                
                // Add tools if available
                if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
                    const tools = await this.promptToolExecutionV1Service.fetchAndValidateTools(prompt.promptAvailableTools);
                    availableTools = [...availableTools, ...tools];
                    // Add tool external names to set
                    tools.forEach(tool => availableToolSet.add(tool.toolExternalName));
                }

                // Add activities if available
                if (prompt.promptAvailableActivities && Object.keys(prompt.promptAvailableActivities).length > 0) {
                    const activities = await this.promptActivityExecutionV1Service.fetchAndValidateActivities(prompt.promptAvailableActivities);
                    availableTools = [...availableTools, ...activities];
                    // Add activity external names to set
                    activities.forEach(activity => availableActivitySet.add(activity.toolExternalName));
                }

                // Add workflows if available
                if (prompt.promptAvailableWorkflows && Object.keys(prompt.promptAvailableWorkflows).length > 0) {
                    const workflows = await this.promptWorkflowExecutionV1Service.fetchAndValidateWorkflows(prompt.promptAvailableWorkflows);
                    availableTools = [...availableTools, ...workflows];
                    // Add workflow external names to set
                    workflows.forEach(workflow => availableWorkflowSet.add(workflow.toolExternalName));
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
                    availableToolSet,
                    availableActivitySet,
                    availableWorkflowSet,
                };

                if (!validationGate || !validationRequired) {
                    return await this.executePromptBase(promptBaseRequest);
                }

                let lastResponse = null;
                while (validationGateRetry < OB1Prompt.DefaultPromptConfig.DEFAULT_VALIDATION_GATE_RETRY) {
                    this.logger.log(`Validation gate retry: ${validationGateRetry}`);
                    lastResponse = await this.executePromptBase(promptBaseRequest);
                    if (lastResponse?.validationPassed) {
                        return lastResponse;
                    }
                    validationGateRetry++;
                }

                throw new BadRequestException({
                    message: 'Response validation failed after all retry attempts',
                    validationScore: lastResponse?.validationResults,
                    originalResponse: lastResponse
                });
            } catch (error) {
                this.logger.error(`Error processing async prompt: ${error.message}`, error.stack);
            }
        }).catch(error => {
            this.logger.error(`Critical error in async processing: ${error.message}`, error.stack);
        });

        // Return immediately with request ID
        return responseAsync;
    }
    async executePromptWithoutUserPromptWithToolsAsync(
        promptRequest: OB1Prompt.ExecutePromptWithoutUserPrompt,
    ): Promise<OB1Prompt.ExecutePromptResponseAsync> {
        // Get the prompt
        const responseAsync: OB1Prompt.ExecutePromptResponseAsync = {
            requestId: promptRequest.requestId,
            requestMetadata: promptRequest.requestMetadata,
            requestorId: promptRequest.personId,
        };
        Promise.resolve().then(async () => {

        try {
            const prompt = await this.promptsRepo.findOne({ where: { promptId: promptRequest.promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptRequest.promptId} not found`);
            }
    
            // Initialize as empty array
            let availableTools: OB1LLM.Tool[] = [];
            const validationRequired = prompt.validationRequired || false;
            const validationGate = prompt.validationGate || false;
            let validationGateRetry = 0;
            // Create sets to track external names
            const availableToolSet = new Set<string>();
            const availableActivitySet = new Set<string>();
            const availableWorkflowSet = new Set<string>();
            
            // Add tools if available
            if (prompt.promptAvailableTools && Object.keys(prompt.promptAvailableTools).length > 0) {
                const tools = await this.promptToolExecutionV1Service.fetchAndValidateTools(prompt.promptAvailableTools);
                availableTools = [...availableTools, ...tools];
                // Add tool external names to set
                tools.forEach(tool => availableToolSet.add(tool.toolExternalName));
            }
    
            // Add activities if available
            if (prompt.promptAvailableActivities && Object.keys(prompt.promptAvailableActivities).length > 0) {
                const activities = await this.promptActivityExecutionV1Service.fetchAndValidateActivities(prompt.promptAvailableActivities);
                availableTools = [...availableTools, ...activities];
                // Add activity external names to set
                activities.forEach(activity => availableActivitySet.add(activity.toolExternalName));
            }
    
            // Add workflows if available
            if (prompt.promptAvailableWorkflows && Object.keys(prompt.promptAvailableWorkflows).length > 0) {
                const workflows = await this.promptWorkflowExecutionV1Service.fetchAndValidateWorkflows(prompt.promptAvailableWorkflows);
                availableTools = [...availableTools, ...workflows];
                // Add workflow external names to set
                workflows.forEach(workflow => availableWorkflowSet.add(workflow.toolExternalName));
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
                availableToolSet,
                availableActivitySet,
                availableWorkflowSet,
            };
    
            // If validation gate is not required, execute once and return
            if (!validationGate) {
                return await this.executePromptBase(promptBaseRequest);
            }
    
            // If validation gate is required, try multiple times
            let lastResponse = null;
            while (validationGateRetry < OB1Prompt.DefaultPromptConfig.DEFAULT_VALIDATION_GATE_RETRY) {
                this.logger.log(`Validation gate retry: ${validationGateRetry}`);
                lastResponse = await this.executePromptBase(promptBaseRequest);
                
                // Check if validation results exist and passed
                if (lastResponse?.validationPassed) {
                    return lastResponse;
                }
                validationGateRetry++;
            }
    
            // If we get here, validation failed after all retries
            throw new BadRequestException({
                message: 'Response validation failed after all retry attempts',
                validationScore: lastResponse?.validationResults,
                originalResponse: lastResponse
            });
        }catch(error){
            this.logger.error(`Error in execute prompt without user prompt with tools async: ${error.message}`, error.stack);
        }
    }).catch(error => {
        this.logger.error(`Error in execute prompt without user prompt with tools async: ${error.message}`, error.stack);
    });
    return responseAsync;
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
