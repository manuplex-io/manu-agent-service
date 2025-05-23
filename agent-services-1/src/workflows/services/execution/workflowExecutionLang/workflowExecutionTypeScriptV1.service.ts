// /src/workflows/services/workflowLang/workflowTypeScriptV1.service.ts

import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { OB1Workflow } from '../../../interfaces/workflow.interface';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, ScheduleClient, WorkflowClient, WorkflowHandle } from '@temporalio/client';
import { WorkflowLoadingV1Service } from '../../workflowLoadingV1.service';
import { ActivityLoadingV1Service } from '../../../../activity/services/activityLoadingV1.service';
import { TSValidationOb1Service } from '../../../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
import { OB1AgentWorkflows } from 'src/workflows/entities/ob1-agent-workflows.entity';
@Injectable()
export class WorkflowExecutionTypeScriptV1Service {
    private readonly logger = new Logger(WorkflowExecutionTypeScriptV1Service.name);
    private TemporalClient: WorkflowClient;
    private TemporalScheduleClient: ScheduleClient;

    constructor(
        @InjectRepository(OB1AgentWorkflows) private readonly workflowRepository: Repository<OB1AgentWorkflows>,
        private readonly workflowLoadingV1Service: WorkflowLoadingV1Service,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
        private readonly activityLoadingV1Service: ActivityLoadingV1Service,
    ) {
        // this.initializeClient();
    }

    // async initializeClient() {
    //     try {
    //         const connection = await Connection.connect({
    //             address: process.env.TEMPORAL_ADDRESS,
    //         });

    //         this.logger.log('Temporal connection established successfully');

    //         this.TemporalClient = new WorkflowClient({
    //             connection,
    //             namespace: process.env.TEMPORAL_NAMESPACE,
    //         });

    //         this.TemporalScheduleClient = new ScheduleClient({
    //             connection,
    //             namespace: process.env.TEMPORAL_NAMESPACE,
    //         });

    //         this.logger.log(`Temporal client initialized with namespace: ${process.env.TEMPORAL_NAMESPACE}`);
    //     } catch (error) {
    //         this.logger.error(`Failed to establish Temporal connection: ${error.message}`);
    //         throw error;
    //     }
    // }

    /**
     * Execute the workflow with the provided workflowInput.
     */
    // async executeWorkflow(
    //     request: OB1Workflow.WorkflowSubServiceExecuteRequest,
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {
    //     const { workflow, workflowInputVariables, workflowENVInputVariables, workflowExecutionConfig } = request;

    //     // isLoaded = await workflowLoadingService.loadANYWorkflow(workflow.workflowId, workflow.workflowLang);

    //     // Initialize response object
    //     const response: OB1Workflow.WorkflowExecutionResponse = {
    //         workflowExecutionResult: {
    //             isStarted: false,
    //             errors: [],
    //             workflowQueueName: '',
    //             result: null,
    //             status: 'UNKNOWN'
    //         },
    //     };

    //     try {
    //         const workflowArgs = this.tsValidationOb1Service.validateInputAgainstInputSchema(workflow.workflowInputSchema, workflowInputVariables);
    //         const workflowExternalName = workflow.workflowExternalName;

    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowENVInputVariables: workflowENVInputVariables,
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         // await this.workflowLoadingV1Service.loadAnyENVToRedis({
    //         //     workflowExternalName: workflowExternalName,
    //         //     workflowENVInputVariables: workflowENVInputVariables,
    //         //     temporalWorkflowId: request.requestId || `workflow-${Date.now()}`,
    //         // });

    //         this.logger.debug(`Workflow function: ${workflowExternalName}`);
    //         // Start the workflow

    //         const input = {
    //             ...workflowInputVariables,
    //         };

    //         const config = {
    //             ...workflowExecutionConfig,
    //             workflowENVInputVariables,
    //         };

    //         const temporalSearchAttributes = this.convertToTemporalSearchAttributes(request);

    //         //To-do
    //         //How and where do we start the workflow?
    //         const handle = await this.TemporalClient.start(workflowExternalName, {
    //             taskQueue: workflowExternalName || 'agentprocess_QUEUE',
    //             workflowId: request.requestId || `workflow-${Date.now()}`,
    //             searchAttributes: {...temporalSearchAttributes},
    //             args: [input, config],
    //         });

    //         // Wait for the workflow to complete and get the result
    //         const result = await handle.result();

    //         // Update response on success
    //         response.workflowExecutionResult.isStarted = true;
    //         response.workflowExecutionResult.result = result;
    //         response.workflowExecutionResult.workflowQueueName = handle.workflowId;
    //         response.workflowExecutionResult.status = 'COMPLETED';
    //         this.logger.debug(`Workflow completed successfully with result: ${result}`);
    //         return response;
    //     } catch (error) {
    //         // Handle errors
    //         this.logger.error(`Failed to execute workflow: ${error.message}`);
    //         // response.workflowExecutionResult.errors.push(error.message);
    //         // response.workflowExecutionResult.status = 'FAILED';
    //         throw new BadRequestException({
    //             message: 'Failed to execute workflow',
    //             errorSuperDetails: { ...error },
    //         });
    //     }

    // }

    // /**
    //  * Execute the workflow with the provided workflowInput.
    //  */
    // async executeWorkflowSync(
    //     request: OB1Workflow.WorkflowSubServiceExecuteRequest,
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {
    //     const { workflow, workflowInputVariables, workflowENVInputVariables, workflowExecutionConfig } = request;

    //     // isLoaded = await workflowLoadingService.loadANYWorkflow(workflow.workflowId, workflow.workflowLang);

    //     // Initialize response object
    //     const response: OB1Workflow.WorkflowExecutionResponse = {
    //         workflowExecutionResult: {
    //             isStarted: false,
    //             errors: [],
    //             workflowQueueName: '',
    //             result: null,
    //             status: 'UNKNOWN'
    //         },
    //     };

    //     try {
    //         // Validate input and get workflow arguments
    //         const workflowArgs = this.tsValidationOb1Service.validateInputAgainstInputSchema(workflow.workflowInputSchema, workflowInputVariables);
    //         const workflowExternalName = workflow.workflowExternalName;

    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowENVInputVariables: workflowENVInputVariables,
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         // await this.workflowLoadingV1Service.loadAnyENVToRedis({
    //         //     workflowExternalName: workflowExternalName,
    //         //     workflowENVInputVariables: workflowENVInputVariables,
    //         //     temporalWorkflowId: request.requestId || `workflow-${Date.now()}`,
    //         // });

    //         const input = {
    //             ...workflowInputVariables,
    //         };

    //         const config = {
    //             ...workflowExecutionConfig,
    //             workflowENVInputVariables,
    //         };

    //         this.logger.debug(`Workflow function: ${workflowExternalName}`);
    //         this.logger.debug(`Workflow args: ${JSON.stringify(workflowInputVariables, null, 2)}`);
    //         // Start the workflow
    //         const temporalSearchAttributes = this.convertToTemporalSearchAttributes(request);

    //         const handle = await this.TemporalClient.start(workflowExternalName, {
    //             taskQueue: workflowExternalName || 'agentprocess_QUEUE',
    //             workflowId: request.requestId || `workflow-${Date.now()}`,
    //             searchAttributes: {...temporalSearchAttributes},
    //             args: [input, config], // Pass input & Config as object with workflowArgs array
    //         });

    //         // Workflow timeout set to 30 seconds
    //         const result = await Promise.race([
    //             handle.result(),
    //             new Promise((_, reject) =>
    //                 setTimeout(() => reject(new Error('Workflow execution timed out')), parseInt(process.env.TEMPORAL_WORKFLOW_TIMEOUT_FOR_SYNC || '30000'))
    //             )
    //         ]);

    //         // Update response on success
    //         response.workflowExecutionResult.isStarted = true;
    //         response.workflowExecutionResult.result = result;
    //         response.workflowExecutionResult.workflowQueueName = handle.workflowId;
    //         response.workflowExecutionResult.status = 'RUNNING';
    //         this.logger.debug(`Workflow completed successfully with result: ${result}`);
    //         return response;
    //     } catch (error) {
    //         // Update error handling to handle timeout specifically
    //         const errorMessage = error.message.includes('timed out')
    //             ? 'Workflow execution timed out after 30 seconds'
    //             : error.message;

    //         this.logger.error(`Failed to execute workflow: ${errorMessage}`);
    //         throw new BadRequestException({
    //             message: 'Failed to execute workflow',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }

    /**
    * Execute the workflow with the provided workflowInput.
    */
    // async executeWorkflowAsync(
    //     request: OB1Workflow.WorkflowSubServiceExecuteRequest,
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {
    //     const { workflow, workflowInputVariables, workflowENVInputVariables, workflowExecutionConfig } = request;
    //     const response: OB1Workflow.WorkflowExecutionResponse = {
    //         workflowExecutionResult: {
    //             isStarted: false,
    //             errors: [],
    //             workflowQueueName: '',
    //             result: null,
    //             temporalWorkflowId: '',
    //             status: 'UNKNOWN'
    //         },
    //     };

    //     try {
    //         const workflowArgs = this.tsValidationOb1Service.validateInputAgainstInputSchema(workflow.workflowInputSchema, workflowInputVariables);
    //         const workflowExternalName = workflow.workflowExternalName;

    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowENVInputVariables: workflowENVInputVariables,
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         // await this.workflowLoadingV1Service.loadAnyENVToRedis({
    //         //     workflowExternalName: workflowExternalName,
    //         //     workflowENVInputVariables: workflowENVInputVariables,
    //         //     temporalWorkflowId: request.requestId || `workflow-${Date.now()}`,
    //         // });

    //         const input = {
    //             ...workflowInputVariables,
    //         };

    //         const config = {
    //             ...workflowExecutionConfig,
    //             workflowENVInputVariables,
    //         };
    //         const temporalSearchAttributes = this.convertToTemporalSearchAttributes(request);

    //         const handle = await this.TemporalClient.start(workflowExternalName, {
    //             taskQueue: workflowExternalName || 'agentprocess_QUEUE',
    //             workflowId: request.requestId || `workflow-${Date.now()}`,
    //             searchAttributes: {...temporalSearchAttributes},
    //             args: [input, config],
    //         });

    //         response.workflowExecutionResult.isStarted = true;
    //         response.workflowExecutionResult.workflowQueueName = handle.workflowId;
    //         response.workflowExecutionResult.temporalWorkflowId = request.requestId;
    //         response.workflowExecutionResult.status = 'RUNNING';

    //         this.logger.debug(`Workflow started asynchronously with Temporal ID: ${request.requestId}`);
    //         return response;
    //     } catch (error) {
    //         this.logger.error(`Failed to execute workflow: ${error.message}`);
    //         throw new BadRequestException({
    //             message: 'Failed to execute workflow',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }


    /**
    * Execute the workflow with the provided workflowInput.(EXPERIMENTAL)
    */
    // async executeMultipleWorkflowAsync(
    //     request: OB1Workflow.WorkflowSubServiceExecuteRequest,
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {
    //     const { workflow, workflowInputVariables, workflowENVInputVariables, workflowExecutionConfig } = request;
    //     const response: OB1Workflow.WorkflowExecutionResponse = {
    //         workflowExecutionResult: {
    //             isStarted: false,
    //             errors: [],
    //             workflowQueueName: '',
    //             result: null,
    //             temporalWorkflowId: '',
    //             status: 'UNKNOWN'
    //         },
    //     };

    //     try {
    //         // const workflowArgs = this.tsValidationOb1Service.validateInputAgainstInputSchema(workflow.workflowInputSchema, workflowInputVariables);
    //         const workflowExternalName = workflow.workflowExternalName;
    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateMultipleWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowIds: request.workflowIds,
    //             workflowENVInputVariables: workflowENVInputVariables,
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         // await this.workflowLoadingV1Service.loadAnyENVToRedis({
    //         //     workflowExternalName: workflowExternalName,
    //         //     workflowENVInputVariables: workflowENVInputVariables,
    //         //     temporalWorkflowId: request.requestId || `workflow-${Date.now()}`,
    //         // });

    //         const input = {
    //             ...workflowInputVariables,
    //         };

    //         const config = {
    //             ...workflowExecutionConfig,
    //             workflowENVInputVariables,
    //         };
    //         const temporalSearchAttributes = this.convertToTemporalSearchAttributes(request);
    //         const handle = await this.TemporalClient.start(workflowExternalName, {
    //             taskQueue: workflowExternalName || 'agentprocess_QUEUE',
    //             workflowId: request.requestId || `workflow-${Date.now()}`,
    //             searchAttributes: {...temporalSearchAttributes},
    //             args: [input, config],
    //         });

    //         response.workflowExecutionResult.isStarted = true;
    //         response.workflowExecutionResult.workflowQueueName = handle.workflowId;
    //         response.workflowExecutionResult.temporalWorkflowId = request.requestId;
    //         response.workflowExecutionResult.status = 'RUNNING';

    //         this.logger.debug(`Workflow started asynchronously with Temporal ID: ${request.requestId}`);
    //         return response;
    //     } catch (error) {
    //         this.logger.error(`Failed to execute workflow: ${error.message}`);
    //         throw new BadRequestException({
    //             message: 'Failed to execute workflow',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }

    /**
    * Execute the workflow with the provided workflowInput.
    */
    // async executeWorkflowScheduled(
    //     request: OB1Workflow.WorkflowSubServiceExecuteRequest,
    // ): Promise<OB1Workflow.WorkflowExecutionResponse> {
    //     const { workflow, workflowInputVariables, workflowENVInputVariables, workflowExecutionConfig, workflowScheduleConfig } = request;
    //     const response: OB1Workflow.WorkflowExecutionResponse = {
    //         workflowExecutionResult: {
    //             isStarted: false,
    //             errors: [],
    //             workflowQueueName: '',
    //             result: null,
    //             temporalScheduleId: '',
    //             status: 'UNKNOWN'
    //         },
    //     };
    //     const MONTHS = [
    //         'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    //         'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    //     ] as const;

    //     try {
    //         const workflowArgs = this.tsValidationOb1Service.validateInputAgainstInputSchema(workflow.workflowInputSchema, workflowInputVariables);
    //         const workflowExternalName = workflow.workflowExternalName;

    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowENVInputVariables: workflowENVInputVariables,
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         // await this.workflowLoadingV1Service.loadAnyENVToRedis({
    //         //     workflowExternalName: workflowExternalName,
    //         //     workflowENVInputVariables: workflowENVInputVariables,
    //         //     temporalWorkflowId: request.requestId || `workflow-${Date.now()}`,
    //         // });


    //         const input = {
    //             ...workflowInputVariables,
    //         };

    //         const config = {
    //             ...workflowExecutionConfig,
    //             workflowENVInputVariables,
    //         };

    //         const temporalScheduleId = `schedule-${request.requestId}-${Date.now()}`;

    //         // const scheduleSpec = {
    //         //     ...(workflowScheduleConfig?.startTime && { startAt: new Date(workflowScheduleConfig.startTime) }),
    //         //     ...(workflowScheduleConfig?.endTime && { endAt: new Date(workflowScheduleConfig.endTime) })
    //         // };

    //         // const startDate = new Date(workflowScheduleConfig.startTime);
    //         const temporalSearchAttributes = this.convertToTemporalSearchAttributes(request);

    //         // // Create calendar spec from the start time
    //         // const calendarSpec = {
    //         //     second: startDate.getUTCSeconds(),
    //         //     minute: startDate.getUTCMinutes(),
    //         //     hour: startDate.getUTCHours(),
    //         //     dayOfMonth: startDate.getUTCDate(),
    //         //     month: MONTHS[startDate.getUTCMonth()], // Convert to Temporal Month enum
    //         //     year: startDate.getUTCFullYear(),
    //         //     comment: `Scheduled execution for ${startDate.toISOString()}`
    //         // };

    //         const schedule = await this.TemporalScheduleClient.create({
    //             scheduleId: temporalScheduleId,
    //             spec: {
    //                 // calendars: [calendarSpec],
    //                 // cronExpressions: ["0 */1 * * * * *"], // Run every 5 minutes
    //                 cronExpressions: ["0 0 7 * * * *", "0 45 11 * * * *"], // Run every day at 5:10 PM

    //             },
    //             action: {
    //                 type: 'startWorkflow',
    //                 workflowType: workflowExternalName,
    //                 taskQueue: workflowExternalName || 'agentprocess_QUEUE',
    //                 args: [input, config],
    //                 searchAttributes: {...temporalSearchAttributes}
    //             },
    //             // state: {
    //             //     remainingActions: 1
    //             // }
    //         });

    //         response.workflowExecutionResult.isStarted = true;
    //         response.workflowExecutionResult.temporalScheduleId = temporalScheduleId;
    //         response.workflowExecutionResult.status = 'UNKNOWN';

    //         this.logger.debug(`Workflow scheduled with Temporal Schedule ID: ${temporalScheduleId}`);
    //         return response;
    //     } catch (error) {
    //         this.logger.error(`Failed to schedule workflow: ${error.message}`);
    //         throw new BadRequestException({
    //             message: 'Failed to schedule workflow',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }

    // Helper methods for checking status
    async getWorkflowExecutionStatus(temporalWorkflowId: string): Promise<OB1Workflow.WorkflowExecutionResponse> {
        const response: OB1Workflow.WorkflowExecutionResponse = {
            workflowExecutionResult: {
                isStarted: false,
                errors: [],
                workflowQueueName: '',
                result: null,
                temporalWorkflowId: temporalWorkflowId,
                status: 'UNKNOWN'
            },
        };

        try {
            // Get the workflow handle using the workflowId
            const handle = this.TemporalClient.getHandle(temporalWorkflowId);

            const description = await handle.describe();
            response.workflowExecutionResult.isStarted = true;
            response.workflowExecutionResult.status = description.status.name;
            response.workflowExecutionResult.workflowQueueName = temporalWorkflowId;

            if (description.status.name === 'COMPLETED') {
                const result = await handle.result();
                response.workflowExecutionResult.result = result;
            } else {
                response.workflowExecutionResult.result = {
                    startTime: description.startTime,
                    closeTime: description.closeTime,
                    executionTime: description.executionTime
                };
            }

            this.logger.debug(`Retrieved workflow status for ID ${temporalWorkflowId}: ${description.status.name}`);
            return response;
        } catch (error) {
            this.logger.error(`Failed to get workflow execution status: ${error.message}`);
            throw new BadRequestException({
                message: 'Failed to get workflow execution status',
                errorSuperDetails: { ...error },
            });
        }
    }

    private convertToTemporalSearchAttributes(request: OB1Workflow.WorkflowSubServiceExecuteRequest): OB1Workflow.TemporalSearchAttributes {
        const { consultantOrgShortName, personId, requestMetadata } = request;
        const userOrgId = requestMetadata.userOrgId; // Assuming userOrgId is stored in requestMetadata
    
        return {
            consultantOrgShortName: [consultantOrgShortName],
            personId: [personId],
            userOrgId: [userOrgId]
        };
    }

    
    /**
    * Execute the workflow with the provided workflowInput.
    */
    // async loadWorkflowCodeToRedis(
    //     workflowExternalName: string,
    // ): Promise<void> {
    //     try {
    //         const workflow = await this.workflowRepository.findOne({ where: { workflowExternalName } });

    //         if (!workflow) {
    //             throw new BadRequestException({
    //                 message: `Workflow with ID ${workflowExternalName} not found`,
    //                 code: 'WORKFLOW_NOT_FOUND',
    //             });
    //         }

    //         // Workflow Validation and Code Preparation result contains all necessary data for workflow execution
    //         const workflowValidationResponse = await this.workflowLoadingV1Service.validateWorkflowAndPrepareCodeForExecution({
    //             workflowId: workflow.workflowId,
    //             workflowENVInputVariables: {},
    //         });

    //         // Load the workflow, activity and ENV to Redis
    //         const workflowLoadingResponse = await this.workflowLoadingV1Service.loadAnyWorkflowToRedis({
    //             workflowCode: workflowValidationResponse.updatedWorkflowCode,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         const activityLoadingResponse = await this.activityLoadingV1Service.loadAnyActivityToRedis({
    //             activityCode: workflowValidationResponse.updatedActivityCode,
    //             imports: workflowValidationResponse.uniqueImports,
    //             workflowExternalName: workflowExternalName,
    //         });

    //         this.logger.debug(`Workflow code loaded successfully to Redis for workflow: ${workflowExternalName}`);
    //         return ;
    //     } catch (error) {
    //         this.logger.error(`Failed to execute workflow: ${error.message}`);
    //         throw new BadRequestException({
    //             message: 'Failed to load workflow code to Redis',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }


    //#region DEPRECATED    
    // async getScheduleStatus(temporalScheduleId: string): Promise<{
    //     state: string;
    //     nextRunTime?: Date;
    //     recentActions?: any[];
    // }> {
    //     try {
    //         const handle = await this.TemporalClient.schedule.getHandle(temporalScheduleId);
    //         const description = await handle.describe();
    //         return {
    //             state: description.schedule.state,
    //             nextRunTime: description.schedule.info.nextRunTime,
    //             recentActions: description.schedule.info.recentActions,
    //         };
    //     } catch (error) {
    //         this.logger.error(`Failed to get schedule status: ${error.message}`);
    //         throw error;
    //     }
    // }

    //executeWorkflowSync
    //executeWorkflowAsync
    //scheduleWorkflow 
    //executeWorkflowAsyncWithCallback ?
    //executeWorkflowAsyncWithPromise ?
    //executeWorkflowAsyncWithObservable ?


    //#region temporary

    // async startSimpleMathWorkflow(a: number, b: number, c: number): Promise<string> {
    //     try {
    //         const handle = await this.client.start(simpleMathWorkflow, {
    //             taskQueue: 'agentprocess_QUEUE',
    //             workflowId: `workflow-${Date.now()}`,
    //             args: [a, b, c],
    //         });

    //         return `Workflow started with ID ${handle.workflowId}`;
    //     } catch (error) {
    //         throw new HttpException(
    //             `Failed to start workflow: ${error.message}`,
    //             HttpStatus.INTERNAL_SERVER_ERROR
    //         );
    //     }
    // }

    //#endregion

    //#region Future Options for Workflow Execution

    // OPTION1: CREATE WORKFLOW MODULE
    // private createWorkflowModule(workflowCode: string, functionName: string): Function {
    //     try {
    //         const moduleContext = {
    //             require: require,
    //             exports: {},
    //             proxyActivities: require('@temporalio/workflow').proxyActivities,
    //         };

    //         const moduleFunction = new Function(
    //             'exports', 
    //             'require', 
    //             'proxyActivities',
    //             workflowCode
    //         );

    //         // Execute the module function with our context
    //         moduleFunction(
    //             moduleContext.exports, 
    //             moduleContext.require, 
    //             moduleContext.proxyActivities
    //         );

    //         const workflowFunction = moduleContext.exports[functionName];

    //         if (!workflowFunction) {
    //             throw new Error(`Workflow function "${functionName}" not found in the provided code`);
    //         }

    //         return workflowFunction;
    //     } catch (error) {
    //         this.logger.error(`Failed to create workflow module: ${error.message}`);
    //         throw new BadRequestException(`Invalid workflow code: ${error.message}`);
    //     }
    // }


    // OPTION2: CREATE TEMPORARY WORKFLOW FILE
    // private readonly WORKFLOW_PATH = (() => {
    //     const distPath = path.join(__dirname, 'temp-workflow-code', 'workflow-template.ts');
    //     const srcPath = path.join(process.cwd(), 'src/workflows/services/execution/workflowExecutionLang/temp-workflow-code/workflow-template.ts');
    //     try {
    //         require.resolve(distPath);
    //         return distPath;
    //     } catch {
    //         return srcPath;
    //     }
    // })();
    // private async createTemporaryWorkflowFile(workflowCode: string): Promise<string> {
    //     const tempDir = path.join(__dirname, 'temp-workflow-code');
    //     const fileName = `workflow-${Date.now()}.ts`;
    //     const filePath = path.join(tempDir, fileName);

    //     try {
    //         // await fs.mkdir(tempDir, { recursive: true });
    //         await fs.writeFile(filePath, workflowCode);

    //         return filePath;
    //     } catch (error) {
    //         this.logger.error(`Failed to create temporary workflow file: ${error.message}`);
    //         throw error;
    //     }
    // }

    // private async loadWorkflowIntoTemplate(workflowCode: string): Promise<string> {
    //     try {
    //         // Overwrite the template file with new workflow code
    //         await fs.writeFile(this.WORKFLOW_PATH, workflowCode);
    //         return this.WORKFLOW_PATH;
    //     } catch (error) {
    //         this.logger.error(`Failed to load workflow into template: ${error.message}`);
    //         throw error;
    //     }
    // }

    // private async cleanupTemporaryFile(filePath: string): Promise<void> {
    //     try {
    //         await fs.unlink(filePath);
    //     } catch (error) {
    //         this.logger.warn(`Failed to cleanup temporary file ${filePath}: ${error.message}`);
    //     }
    // }

    // async compileWorkflowFromString(workflowCode: string): Promise<any> {
    //     const result = await esbuild.build({
    //       stdin: {
    //         contents: workflowCode,
    //         resolveDir: __dirname,
    //         sourcefile: 'tempWorkflow.ts',
    //       },
    //       bundle: true,
    //       platform: 'node',
    //       target: 'node14',
    //       format: 'cjs',
    //       write: false, // Do not write to disk
    //     });

    //     // Get compiled code as a string
    //     const compiledCode = result.outputFiles[0].text;

    //     // Use the Function constructor to create an isolated scope
    //     const module = { exports: {} };
    //     const func = new Function('module', 'exports', compiledCode);
    //     func(module, module.exports);

    //     return module.exports;
    //   }

    // Fall back in case the temporary workflow path is not found
    // async onModuleInit() {
    //     try {
    //         const dir = path.dirname(this.WORKFLOW_PATH);
    //         await fs.mkdir(dir, { recursive: true });
    //         try {
    //             await fs.access(this.WORKFLOW_PATH);
    //         } catch {
    //             await fs.writeFile(this.WORKFLOW_PATH, 'export default function placeholder() {}');
    //         }
    //     } catch (error) {
    //         this.logger.error(`Failed to initialize template: ${error.message}`);
    //     }
    // }
    //#endregion
    //#endregion
}
