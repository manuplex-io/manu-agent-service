// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentActivities } from '../../../activity/entities/ob1-agent-activities.entity';
import { WorkflowExecutionTypeScriptV2Service } from '../../../workflows/services/execution/workflowExecutionLang/workflowExecutionTypeScriptV2.service';
import { PromptLogV1Service } from '../log/promptLogV1.service';
import { OB1LLM } from '../../../llms/interfaces/llmV2.interfaces';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';
import { v4 as uuid } from 'uuid';
import { OB1Workflow } from 'src/workflows/interfaces/workflow.interface';


@Injectable()
export class PromptActivityExecutionV1Service {
    private readonly logger = new Logger(PromptActivityExecutionV1Service.name);

    constructor(
        @InjectRepository(OB1AgentActivities) private activitiesRepo: Repository<OB1AgentActivities>,
        private readonly workflowExecutionTypeScriptV2Service: WorkflowExecutionTypeScriptV2Service,
        private readonly promptLogV1Service: PromptLogV1Service
    ) { }

    async fetchAndValidateActivities(activityIds: string[]): Promise<OB1LLM.Tool[]> {
        // Fetch tool information
        const activitiesInfo = await this.activitiesRepo.find({
            where: activityIds.map(activityId => ({ activityId })),
            select: [
                'activityId',
                'activityExternalName',
                'activityDescription',
                'activityInputSchema',
                'activityOutputSchema',
            ]
        });

        // Validate that all requested tools were found
        if (activitiesInfo.length !== activityIds.length) {
            const foundActivityIds = activitiesInfo.map(activity => activity.activityId);
            const missingActivities = activityIds.filter(id => !foundActivityIds.includes(id));
            throw new NotFoundException(`Activities not found: ${missingActivities.join(', ')}`);
        }

        // Convert to LLM Tool format
        return activitiesInfo.map(activity => ({
            toolId: activity.activityId,
            toolExternalName: activity.activityExternalName,
            toolDescription: activity.activityDescription,
            toolInputSchema: activity.activityInputSchema,
            toolOutputSchema: activity.activityOutputSchema
        }));
    }


    async executeParallelActivityCalls(Request: {
        toolCalls: OB1LLM.ChatCompletionMessageToolCall[],
        toolENVInputVariables?: Record<string, any>;
        tracing: OB1LLM.promptTracing,
        timeout: number,
        consultantOrgShortName: string,
        personId: string,
        requestMetadata: { [key: string]: any }
    }): Promise<{
        newToolResults: Record<string, any>,
        toolCallLogs: OB1Tool.ToolCallLog[]
    }> {
        const activityCallLogs: OB1Tool.ToolCallLog[] = [];

        //this.logger.log(`3. Inside executeParallelToolCalls (straight): ${JSON.stringify(Request)}`);
        //this.logger.log(`3A. Inside executeParallelToolCalls:\n${JSON.stringify(Request, null, 2)}`);
        // First fetch all tool information
        const startToolsTime = Date.now();
        const toolsTracing = {
            traceId: Request.tracing.traceId,
            parentSpanId: Request.tracing.spanId,
            spanId: uuid(),
            spanName: `Tool(activity) Calls`,
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

        const activityExternalNames = [...new Set(Request.toolCalls.map(tc => tc.function.name))];
        //this.logger.log(`3B. Tool External Names: ${JSON.stringify(toolExternalNames)}`);
        const activityInfoCollections = await this.activitiesRepo.find({
            where: activityExternalNames.map(activityExternalName => ({ activityExternalName })),
            select: [
                'activityId',
                'activityExternalName',
                'activityDescription'
            ]
        });

        //this.logger.log(`3C. Tools Info Collection: ${JSON.stringify(toolsInfoCollection, null, 2)}`);

        const eachToolresultsArray = await Promise.all(
            Request.toolCalls.map(async (toolCall) => {
                const activityInfo = activityInfoCollections.find(t => t.activityExternalName === toolCall.function.name);
                if (!activityInfo) {
                    throw new NotFoundException(`Activity not found: ${toolCall.function.name}`);
                }
                const activityTracing = {
                    traceId: Request.tracing.traceId,
                    parentSpanId: Request.tracing.spanId,
                    spanId: uuid(),
                    spanName: `activity_execution_${activityInfo.activityExternalName}`,
                    additionalProperties: 'Tool execution logs'
                };

                const activityRequest = {
                    toolCall,
                    toolENVInputVariables: Request?.toolENVInputVariables,
                    activityInfo,
                    tracing: activityTracing,
                    timeout: Request.timeout,
                    requestMetadata: Request.requestMetadata,
                    consultantOrgShortName: Request.consultantOrgShortName,
                    personId: Request.requestMetadata.personId
                };

                // declare a new toolRequestMessages array with role = tool, contant = toolRequest, tool_call_id = toolCall.id
                const toolRequestMessages = [
                    {
                        role: 'tool',
                        content: JSON.stringify(activityRequest),
                        tool_call_id: toolCall.id
                    }
                ];

                this.logger.log(`3D.Each workflow Request: ${JSON.stringify(activityRequest, null, 2)}`);

                const startToolTime = Date.now();

                const result = await this.executeActivityCall(activityRequest);

                // Add to toolCallLogs
                activityCallLogs.push({
                    toolName: activityInfo.activityExternalName,
                    toolInputArguments: JSON.parse(toolCall.function.arguments),
                    toolOutput: result.workflowExecutionResult.result,
                    toolExecutionTime: 0,
                    toolDescription: activityInfo.activityDescription
                });

                const toolResponse = {
                    content: {
                        name: activityInfo.activityExternalName,
                        output: result.workflowExecutionResult.result,
                        successful: result.workflowExecutionResult.status === 'COMPLETED',
                        error: result.workflowExecutionResult.errors
                    },
                    tool_call_id: toolCall.id,
                    //arguments: toolCall.function.arguments,
                    //executionTime: result.toolExecutionTime,

                };
                //this.logger.log(`4. Every Tool response: ${JSON.stringify(toolResponse)}`);
                //this.logger.log(`4. Every Tool response:\n${JSON.stringify(toolResponse, null, 2)}`);

                // Log tool execution
                const responseTime = result.workflowExecutionResult.result || (Date.now() - startToolTime);
                // Construct log data
                const logData = {
                    request: {
                        body: {
                            messages: toolRequestMessages
                        }
                    },
                    response: {   // @Need to Fix this, it does not pretty format like the master Tool call Log in Portkey
                        status: result.workflowExecutionResult.status === 'COMPLETED' ? 200 : 500,
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
                    metadata: activityTracing,
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
                        content: JSON.stringify(activityCallLogs),
                        tool_calls: activityCallLogs.map(tc => tc.toolName)
                    }
                }
            ]
        };

        // Log tool execution
        const toolsResponseTime = (Date.now() - startToolsTime);

        const WorkflowlogData = {
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
        await this.promptLogV1Service.sendToolLogToPortkey(WorkflowlogData);
        return {
            newToolResults: eachToolresultsArray,
            toolCallLogs: activityCallLogs
        };
    }

    async executeActivityCall(Request: {
        toolCall: OB1LLM.ChatCompletionMessageToolCall,
        toolENVInputVariables?: Record<string, any>;
        activityInfo: OB1AgentActivities,
        tracing: OB1LLM.promptTracing,
        timeout: number,
        requestMetadata: { [key: string]: any },
        consultantOrgShortName: string,
        personId: string
    }
    ): Promise<OB1Workflow.WorkflowExecutionResponse> {
        const workflowRequest: OB1Workflow.ActivitySubServiceExecuteRequest = {
            activityId: Request.activityInfo.activityId,
            workflowInputVariables: JSON.parse(Request.toolCall.function.arguments), // Convert to an object 
            workflowENVInputVariables: Request.toolENVInputVariables || {},
            workflowExecutionConfig: {},
            requestId: 'prompt-'+Date.now(),
            requestMetadata: Request.requestMetadata,
            consultantOrgShortName: Request.consultantOrgShortName,
            personId: Request.personId
        };

        this.logger.log(`Executing activity: ${Request.activityInfo.activityExternalName}`);

        try {
            const result: OB1Workflow.WorkflowExecutionResponse = await Promise.race([
                this.workflowExecutionTypeScriptV2Service.executeWorkflowFromActivity(workflowRequest),
                new Promise<OB1Workflow.WorkflowExecutionResponse>((_, reject) =>
                    setTimeout(() => reject(new Error('Workflow(Activity) execution timeout')), Request.timeout)
                )
            ]);
            this.logger.log('Workflow(Activity) execution successful, result:', result);
            return result;
        } catch (error) {
            this.logger.error(`Workflow(Activity) execution failed: ${error.message}`, error.stack);
            return {
                workflowExecutionResult: {
                    isStarted: false,
                    errors: [],
                    workflowQueueName: '',
                    result: null,
                    status: 'UNKNOWN'
                }
            };
        }
    }
}