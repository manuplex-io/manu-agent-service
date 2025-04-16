// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentWorkflows } from '../../../workflows/entities/ob1-agent-workflows.entity';
import { WorkflowExecutionTypeScriptV2Service } from '../../../workflows/services/execution/workflowExecutionLang/workflowExecutionTypeScriptV2.service';
import { PromptLogV1Service } from '../log/promptLogV1.service';
import { OB1LLM } from '../../../llms/interfaces/llmV2.interfaces';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';
import { v4 as uuid } from 'uuid';
import { OB1Workflow } from 'src/workflows/interfaces/workflow.interface';


@Injectable()
export class PromptWorkflowExecutionV1Service {
    private readonly logger = new Logger(PromptWorkflowExecutionV1Service.name);

    constructor(
        @InjectRepository(OB1AgentWorkflows) private workflowsRepo: Repository<OB1AgentWorkflows>,
        private readonly workflowExecutionTypeScriptV2Service: WorkflowExecutionTypeScriptV2Service,
        private readonly promptLogV1Service: PromptLogV1Service
    ) { }

    async fetchAndValidateWorkflows(workflowIds: string[]): Promise<OB1LLM.Tool[]> {
        // Fetch tool information
        const workflowsInfo = await this.workflowsRepo.find({
            where: workflowIds.map(workflowId => ({ workflowId })),
            select: [
                'workflowId',
                'workflowExternalName',
                'workflowDescription',
                'workflowInputSchema',
                'workflowOutputSchema',
            ]
        });

        // Validate that all requested tools were found
        if (workflowsInfo.length !== workflowIds.length) {
            const foundWorkflowIds = workflowsInfo.map(workflow => workflow.workflowId);
            const missingWorkflows = workflowIds.filter(id => !foundWorkflowIds.includes(id));
            throw new NotFoundException(`Workflows not found: ${missingWorkflows.join(', ')}`);
        }

        // Convert to LLM Tool format
        return workflowsInfo.map(workflow => ({
            toolId: workflow.workflowId,
            toolExternalName: workflow.workflowExternalName,
            toolDescription: workflow.workflowDescription,
            toolInputSchema: workflow.workflowInputSchema,
            toolOutputSchema: workflow.workflowOutputSchema
        }));
    }


    // async executeParallelWorkflowCalls(Request: {
    //     toolCalls: OB1LLM.ChatCompletionMessageToolCall[],
    //     toolENVInputVariables?: Record<string, any>;
    //     tracing: OB1LLM.promptTracing,
    //     timeout: number,
    //     consultantOrgShortName: string,
    //     personId: string,
    //     requestMetadata: { [key: string]: any }
    // }): Promise<{
    //     newToolResults: Record<string, any>,
    //     toolCallLogs: OB1Tool.ToolCallLog[]
    // }> {
    //     const workflowCallLogs: OB1Tool.ToolCallLog[] = [];

    //     //this.logger.log(`3. Inside executeParallelToolCalls (straight): ${JSON.stringify(Request)}`);
    //     //this.logger.log(`3A. Inside executeParallelToolCalls:\n${JSON.stringify(Request, null, 2)}`);
    //     // First fetch all tool information
    //     const startToolsTime = Date.now();
    //     const toolsTracing = {
    //         traceId: Request.tracing.traceId,
    //         parentSpanId: Request.tracing.spanId,
    //         spanId: uuid(),
    //         spanName: `Tool(workflow) Calls`,
    //         //additionalProperties: 'Tool execution logs'
    //     };

    //     Request.tracing.spanId = toolsTracing.spanId; // Update the spanId for the next level of tracing

    //     const toolsRequestMessages = {
    //         messages: [
    //             {
    //                 role: 'tool',
    //                 content: JSON.stringify(Request.toolCalls),
    //                 //tool_calls: Request.toolCalls.map(tc => tc.id)
    //             }
    //         ]
    //     };

    //     const workflowExternalNames = [...new Set(Request.toolCalls.map(tc => tc.function.name))];
    //     //this.logger.log(`3B. Tool External Names: ${JSON.stringify(toolExternalNames)}`);
    //     const workflowInfoCollections = await this.workflowsRepo.find({
    //         where: workflowExternalNames.map(workflowExternalName => ({ workflowExternalName })),
    //         select: [
    //             'workflowId',
    //             'workflowExternalName',
    //             'workflowDescription',
    //             'workflowInputSchema',
    //             'workflowOutputSchema'
    //         ]
    //     });

    //     //this.logger.log(`3C. Tools Info Collection: ${JSON.stringify(toolsInfoCollection, null, 2)}`);

    //     const eachToolresultsArray = await Promise.all(
    //         Request.toolCalls.map(async (toolCall) => {
    //             const workflowInfo = workflowInfoCollections.find(t => t.workflowExternalName === toolCall.function.name);
    //             if (!workflowInfo) {
    //                 throw new NotFoundException(`Workflow not found: ${toolCall.function.name}`);
    //             }
    //             const workflowTracing = {
    //                 traceId: Request.tracing.traceId,
    //                 parentSpanId: Request.tracing.spanId,
    //                 spanId: uuid(),
    //                 spanName: `workflow_execution_${workflowInfo.workflowExternalName}`,
    //                 additionalProperties: 'Tool execution logs'
    //             };

    //             const workflowRequest = {
    //                 toolCall,
    //                 toolENVInputVariables: Request?.toolENVInputVariables,
    //                 workflowInfo,
    //                 tracing: workflowTracing,
    //                 timeout: Request.timeout,
    //                 requestMetadata: Request.requestMetadata,
    //                 consultantOrgShortName: Request.consultantOrgShortName,
    //                 personId: Request.requestMetadata.personId
    //             };

    //             // declare a new toolRequestMessages array with role = tool, contant = toolRequest, tool_call_id = toolCall.id
    //             const toolRequestMessages = [
    //                 {
    //                     role: 'tool',
    //                     content: JSON.stringify(workflowRequest),
    //                     tool_call_id: toolCall.id
    //                 }
    //             ];

    //             this.logger.log(`3D.Each workflow Request: ${JSON.stringify(workflowRequest, null, 2)}`);

    //             const startToolTime = Date.now();

    //             const result = await this.executeWorkflowCall(workflowRequest);

    //             // Add to toolCallLogs
    //             workflowCallLogs.push({
    //                 toolName: workflowInfo.workflowExternalName,
    //                 toolInputArguments: JSON.parse(toolCall.function.arguments),
    //                 toolOutput: result.workflowExecutionResult.result,
    //                 toolExecutionTime: 0,
    //                 toolDescription: workflowInfo.workflowDescription
    //             });

    //             const toolResponse = {
    //                 content: {
    //                     name: workflowInfo.workflowExternalName,
    //                     output: result.workflowExecutionResult.result,
    //                     successful: result.workflowExecutionResult.status === 'COMPLETED',
    //                     error: result.workflowExecutionResult.errors
    //                 },
    //                 tool_call_id: toolCall.id,
    //                 //arguments: toolCall.function.arguments,
    //                 //executionTime: result.toolExecutionTime,

    //             };
    //             //this.logger.log(`4. Every Tool response: ${JSON.stringify(toolResponse)}`);
    //             //this.logger.log(`4. Every Tool response:\n${JSON.stringify(toolResponse, null, 2)}`);

    //             // Log tool execution
    //             const responseTime = result.workflowExecutionResult.result || (Date.now() - startToolTime);
    //             // Construct log data
    //             const logData = {
    //                 request: {
    //                     body: {
    //                         messages: toolRequestMessages
    //                     }
    //                 },
    //                 response: {   // @Need to Fix this, it does not pretty format like the master Tool call Log in Portkey
    //                     status: result.workflowExecutionResult.status === 'COMPLETED' ? 200 : 500,
    //                     body: {
    //                         choices: [
    //                             {
    //                                 message: {
    //                                     role: 'tool',
    //                                     content: JSON.stringify(toolResponse),
    //                                     tool_calls: toolCall.id
    //                                 }
    //                             }]
    //                     },
    //                     response_time: responseTime
    //                 },
    //                 metadata: workflowTracing,
    //             };

    //             // Send the tool log to Portkey
    //             await this.promptLogV1Service.sendToolLogToPortkey(logData);

    //             return {
    //                 ...toolResponse
    //             };
    //         })
    //     );

    //     const toolsResponseMessages = {
    //         choices: [
    //             {
    //                 message: {
    //                     role: 'tool',
    //                     content: JSON.stringify(workflowCallLogs),
    //                     tool_calls: workflowCallLogs.map(tc => tc.toolName)
    //                 }
    //             }
    //         ]
    //     };

    //     // Log tool execution
    //     const toolsResponseTime = (Date.now() - startToolsTime);

    //     const WorkflowlogData = {
    //         request: {
    //             body: toolsRequestMessages
    //         },
    //         response: {
    //             status: 200,
    //             body: toolsResponseMessages,
    //             response_time: toolsResponseTime
    //         },
    //         metadata: toolsTracing,
    //     };

    //     // Send the tool log to Portkey
    //     await this.promptLogV1Service.sendToolLogToPortkey(WorkflowlogData);

    //     // const newToolResults = eachToolresults.reduce((acc, eachToolresults) => {
    //     //     acc[eachToolresults.content.name] = eachToolresults;
    //     //     return acc;
    //     // }, {});

    //     return {
    //         newToolResults: eachToolresultsArray,
    //         toolCallLogs: workflowCallLogs
    //     };
    // }

    // async executeWorkflowCall(Request: {
    //     toolCall: OB1LLM.ChatCompletionMessageToolCall,
    //     toolENVInputVariables?: Record<string, any>;
    //     workflowInfo: OB1AgentWorkflows,
    //     tracing: OB1LLM.promptTracing,
    //     timeout: number,
    //     requestMetadata: { [key: string]: any },
    //     consultantOrgShortName: string,
    //     personId: string
    // }
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {

    //     const workflowRequest: OB1Workflow.WorkflowSubServiceExecuteRequest = {
    //         workflow: Request.workflowInfo,
    //         workflowId: Request.workflowInfo.workflowId,
    //         workflowInputVariables: JSON.parse(Request.toolCall.function.arguments), // Convert to an object 
    //         workflowENVInputVariables: Request.toolENVInputVariables || {},
    //         workflowExecutionConfig: {},
    //         requestId: 'prompt-'+Date.now(),
    //         requestMetadata: Request.requestMetadata,
    //         consultantOrgShortName: Request.consultantOrgShortName,
    //         personId: Request.personId
    //     };

    //     this.logger.log(`Executing workflow: ${Request.workflowInfo.workflowExternalName}`);

    //     try {
    //         const result: OB1Workflow.WorkflowExecutionResponse = await Promise.race([
    //             this.workflowExecutionTypeScriptV2Service.executeWorkflowSync(workflowRequest),
    //             new Promise<OB1Workflow.WorkflowExecutionResponse>((_, reject) =>
    //                 setTimeout(() => reject(new Error('Workflow execution timeout')), Request.timeout)
    //             )
    //         ]);
    //         this.logger.log('Workflow execution successful, result:', result);
    //         return result;
    //     } catch (error) {
    //         this.logger.error(`Workflow execution failed: ${error.message}`, error.stack);
    //         return {
    //             workflowExecutionResult: {
    //                 isStarted: false,
    //                 errors: [],
    //                 workflowQueueName: '',
    //                 result: null,
    //                 status: 'UNKNOWN'
    //             }
    //         };
    //     }
    // }
}