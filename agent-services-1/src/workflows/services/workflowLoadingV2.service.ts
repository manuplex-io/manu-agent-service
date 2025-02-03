    // /src/workflows/services/workflowManagementV1.service.ts

    import { Injectable, Logger, BadRequestException } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository, In } from 'typeorm';
    // import * as ts from 'typescript';

    import { OB1AgentWorkflows } from '../entities/ob1-agent-workflows.entity';
    import { OB1AgentActivities } from 'src/activity/entities/ob1-agent-activities.entity';
    //import { OB1Activity } from '../../activity/interfaces/activity.interface';

    import { RedisOb1Service } from '../../aa-common/redis-ob1/services/redis-ob1.service';
    import { OB1Activity } from 'src/activity/interfaces/activity.interface';
    import { OB1Workflow } from '../interfaces/workflow.interface';
    import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
    import { OB1TSValidation } from 'src/aa-common/ts-validation-ob1/interfaces/ts-validation-ob1.interface';

    @Injectable()
    export class WorkflowLoadingV2Service {
        private readonly logger = new Logger(WorkflowLoadingV2Service.name);
        private readonly REDIS_WORKFLOW_BASE_KEY = 'agentService:workerService:workflows';
        private readonly REDIS_ENV_BASE_KEY = 'agentService:workerService:ENVVariables';
        
        constructor(
            @InjectRepository(OB1AgentWorkflows) private readonly workflowRepository: Repository<OB1AgentWorkflows>,
            private readonly redisService: RedisOb1Service,
            private readonly tsValidationOb1Service: TSValidationOb1Service,
        ) { }
        //#region workflow loading specific validation
        
        public async validateWorkflowAndPrepareCodeForExecution(request: OB1Workflow.WorkflowValidationRequestV2): Promise<OB1Workflow.WorkflowValidationResponseV2> {
            try {
                const { mainWorkflow, workflowENVInputVariables, workflowActivityCodeMap, workflowUniqueActivityNames } = request;

                if (!mainWorkflow) {
                    throw new Error(`Workflow with ID ${mainWorkflow.workflowId} not found`);
                }

                // TODO: Reinstate this redis cache later.
                const redisActivityKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:activityCode`;
                const redisWorkflowKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}`;
                const redisImportKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:imports`;

                const redisExistingActivityCode = await this.redisService.get(redisActivityKey);
                const redisExistingWorkflowCode = await this.redisService.get(redisWorkflowKey);
                const redisExistingImports = await this.redisService.getSet(redisImportKey);

                if (redisExistingActivityCode && redisExistingWorkflowCode) {
                    return {
                        updatedWorkflowCode: redisExistingWorkflowCode,
                    };
                }

                // Process only the main workflow's code
                let updatedWorkflowCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                    sourceCode: mainWorkflow.workflowCode,
                    newFunctionName: mainWorkflow.workflowExternalName,
                    functionType: OB1TSValidation.FunctionType.WORKFLOW
                });
                const activityCode = workflowActivityCodeMap.get(mainWorkflow.workflowExternalName);
                const uniqueActivityNames = workflowUniqueActivityNames.get(mainWorkflow.workflowExternalName);
                //This gets rid of the duplicated imports
                updatedWorkflowCode = this.tsValidationOb1Service.validateAndConsolidateWorkflowImports(updatedWorkflowCode);
                updatedWorkflowCode = this.tsValidationOb1Service.validateAndConsolidateActivityImports(updatedWorkflowCode, Array.from(uniqueActivityNames));

                // Validate ENV input variables against the merged ENV schema
                // const inputValidationResult = this.tsValidationOb1Service.validateInputAgainstInputSchema(
                //     mergedENVinputSchema, 
                //     workflowENVInputVariables
                // );
                // Compile TypeScript for validation

                await this.tsValidationOb1Service.compileTypeScriptCheckForWorkflowExecution(
                    updatedWorkflowCode, 
                    activityCode
                );

                return {
                    updatedWorkflowCode: updatedWorkflowCode,
                };
            } catch (error) {
                this.logger.error(`Failed to pass initial validation for workflow:\n${JSON.stringify(error, null, 2)}`);
                throw new BadRequestException({
                    message: 'Failed to pass initial validation for workflow',
                    errorSuperDetails: { ...error },
                });
            }
        }

        // Load Any Redis
        async loadAnyWorkflowToRedis(request: OB1Workflow.WorkflowLoadingRequest): Promise<void> {
            try {
                const { workflowCode, workflowExternalName } = request;
                let isTTLUpdated = false;
                const redisKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${workflowExternalName}`;
                const redisExistingVal = await this.redisService.get(redisKey);

                // if workflow is already in redis, then return the code
                if(redisExistingVal){
                    const updateRedisWorkflowTTL = await this.redisService.updateTTL(redisKey, Number(process.env.REDIS_DEFAULT_TTL_FOR_TEMPORAL_WORKFLOW));
                    if(updateRedisWorkflowTTL){
                        isTTLUpdated = true;
                    }
                }

                if(isTTLUpdated){ 
                    return;
                }
                // FUNCTION doesn't exist in redis, continue with loading
                // Validation + Clean up

                // Generate Redis key using base key and workflow name
                // Store workflow code in Redis
                const workflowResult = await this.redisService.set(redisKey, workflowCode);
                this.logger.log(`Workflow loaded to Redis successfully`);
                return;
            } catch (error) {
                this.logger.error(`Failed to load workflow to Redis:\n${JSON.stringify(error, null, 2)}`);
                throw new BadRequestException({
                    message: 'Failed to load workflow to Redis',
                    errorSuperDetails: { ...error },
                });
            }
        }

        async loadAnyENVToRedis(request: OB1Workflow.WorkflowENVLoadingRequest): Promise<void> {
            try {
                const { workflowExternalName, workflowENVInputVariables, temporalWorkflowId } = request;
                const redisKey = `${this.REDIS_ENV_BASE_KEY}:${temporalWorkflowId}`;
                await this.redisService.setJson(redisKey, workflowENVInputVariables);
                this.logger.log(`ENV variables loaded to Redis successfully`);
                return;
            } catch (error) {
                this.logger.error(`Failed to load ENV variables to Redis:\n${JSON.stringify(error, null, 2)}`);
                throw new BadRequestException({
                    message: 'Failed to load ENV variables to Redis',
                    errorSuperDetails: { ...error },
                });
            }
        }

        async createWorkflowFromActivity(activity: OB1AgentActivities): Promise<OB1Workflow.WorkflowValidationRequestV2> {
            // Create workflow code from template
            const workflowCode = `import { proxyActivities } from '@temporalio/workflow';
                import type * as activities from './myActivity';

                const { ${activity.activityExternalName} } = proxyActivities<typeof activities>({
                    startToCloseTimeout: '1 minute',
                });

                export async function myWorkflow(input: any): Promise<any> {
                    const result = await ${activity.activityExternalName}(input);
                    return result;
                }`;

            // Create minimal workflow entity
            const mainWorkflow = new OB1AgentWorkflows();
            mainWorkflow.workflowCode = workflowCode;
            mainWorkflow.workflowName = `workflow_${activity.activityName}`;
            mainWorkflow.workflowExternalName = `workflow_${activity.activityExternalName}`;
            mainWorkflow.workflowType = OB1Workflow.WorkflowType.TEMPORAL;
            mainWorkflow.workflowLang = OB1Workflow.WorkflowLang.TYPESCRIPT;
            mainWorkflow.workflowInputSchema = activity.activityInputSchema;
            mainWorkflow.workflowENVInputSchema = activity.activityENVInputSchema;
            mainWorkflow.workflowOutputSchema = activity.activityOutputSchema;

            // Create activity code map
            const workflowActivityCodeMap = new Map<string, string>();
            workflowActivityCodeMap.set(mainWorkflow.workflowExternalName, activity.activityCode);

            // Create activity import map
            const workflowActivityImportMap = new Map<string, Set<string>>();
            const activityImports = new Set<string>();
            activity.activityImports.forEach((imports) => {
                activityImports.add(imports);
            });
            workflowActivityImportMap.set(mainWorkflow.workflowExternalName, activityImports);

            // Create unique activity names map
            const workflowUniqueActivityNames = new Map<string, Set<string>>();
            const activityNames = new Set<string>();
            activityNames.add(activity.activityExternalName);
            workflowUniqueActivityNames.set(mainWorkflow.workflowExternalName, activityNames);

            return {
                mainWorkflow,
                workflowActivityCodeMap,
                workflowUniqueActivityNames,
                workflowActivityImportMap,
            };
        }
    }