// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolsExecutionV1Service } from '../../../tools/services/toolsExecutionV1.service';
import { PromptLogV1Service } from '../log/promptLogV1.service';
import { OB1LLM } from '../../../llms/interfaces/llmV2.interfaces';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';
import { v4 as uuid } from 'uuid';
import { OB1AgentTools } from 'src/tools/entities/ob1-agent-tools.entity';


@Injectable()
export class PromptToolExecutionV1Service {
    private readonly logger = new Logger(PromptToolExecutionV1Service.name);

    constructor(
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        private readonly toolExecutionV1Service: ToolsExecutionV1Service,
        private readonly promptLogV1Service: PromptLogV1Service
    ) { }

    async fetchAndValidateTools(toolIds: string[]): Promise<OB1LLM.Tool[]> {
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



    async executeParallelToolCalls(Request: {
        toolCalls: OB1LLM.ChatCompletionMessageToolCall[],
        toolENVInputVariables?: Record<string, any>;
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
                'toolDescription'
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
                    toolENVInputVariables: Request?.toolENVInputVariables,
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
                    toolDescription: toolInfo.toolDescription
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
                await this.promptLogV1Service.sendToolLogToPortkey(logData);

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
        await this.promptLogV1Service.sendToolLogToPortkey(ToolslogData);

        // const newToolResults = eachToolresults.reduce((acc, eachToolresults) => {
        //     acc[eachToolresults.content.name] = eachToolresults;
        //     return acc;
        // }, {});

        return {
            newToolResults: eachToolresultsArray,
            toolCallLogs
        };
    }

    async executeToolCall(Request: {
        toolCall: OB1LLM.ChatCompletionMessageToolCall,
        toolENVInputVariables?: Record<string, any>;
        toolInfo: OB1AgentTools,
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any }
    }
    ): Promise<OB1Tool.ToolResponse> {
        const toolRequest: OB1Tool.ToolRequest = {
            toolId: Request.toolInfo.toolId,
            toolInputVariables: JSON.parse(Request.toolCall.function.arguments), // Convert to an object 
            toolENVInputVariables: Request?.toolENVInputVariables,
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

}