    // /src/workflows/services/workflowManagementV1.service.ts

    import { Injectable, Logger, BadRequestException } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository, In } from 'typeorm';
    // import * as ts from 'typescript';

    import { OB1AgentWorkflows } from '../entities/ob1-agent-workflows.entity';

    //import { OB1Activity } from '../../activity/interfaces/activity.interface';

    import { RedisOb1Service } from '../../aa-common/redis-ob1/services/redis-ob1.service';
    import { OB1Activity } from 'src/activity/interfaces/activity.interface';
    import { OB1Workflow } from '../interfaces/workflow.interface';
    import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
    import { OB1TSValidation } from 'src/aa-common/ts-validation-ob1/interfaces/ts-validation-ob1.interface';

    @Injectable()
    export class WorkflowLoadingV1Service {
        private readonly logger = new Logger(WorkflowLoadingV1Service.name);
        private readonly REDIS_WORKFLOW_BASE_KEY = 'agentService:workerService:workflows';
        private readonly REDIS_ENV_BASE_KEY = 'agentService:workerService:ENVVariables';
        
        constructor(
            @InjectRepository(OB1AgentWorkflows) private readonly workflowRepository: Repository<OB1AgentWorkflows>,
            private readonly redisService: RedisOb1Service,
            private readonly tsValidationOb1Service: TSValidationOb1Service,
        ) { }
        //#region workflow loading specific validation
        
        public async validateWorkflowAndPrepareCodeForExecution(request: OB1Workflow.WorkflowValidationRequest): Promise<OB1Workflow.WorkflowValidationResponse> {
            try {
                const { workflowId, workflowENVInputVariables } = request;
                
                // First, check Redis cache for the main workflow
                const mainWorkflow = await this.workflowRepository.findOne({
                    where: { workflowId: workflowId },
                    relations: ['workflowCategory'],
                });

                if (!mainWorkflow) {
                    throw new Error(`Workflow with ID ${workflowId} not found`);
                }

                const redisActivityKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:activityCode`;
                const redisWorkflowKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}`;
                const redisImportKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:imports`;

                const redisExistingActivityCode = await this.redisService.get(redisActivityKey);
                const redisExistingWorkflowCode = await this.redisService.get(redisWorkflowKey);
                const redisExistingImports = await this.redisService.getSet(redisImportKey);

                if (redisExistingActivityCode && redisExistingWorkflowCode) {
                    return {
                        workflow: mainWorkflow,
                        updatedWorkflowCode: redisExistingWorkflowCode,
                        updatedActivityCode: redisExistingActivityCode,
                        uniqueImports: new Set(redisExistingImports),
                    };
                }

                // Track processed workflows to prevent infinite loops
                const processedWorkflows = new Set<string>();
                // Queue for workflows that need processing
                const workflowQueue: string[] = [workflowId];
                
                let mergedActivityCode = '';
                const uniqueImports = new Set<string>();
                const uniqueActivityNames = new Set<string>();
                const mergedENVinputSchema = {
                    type: 'object',
                    properties: {},
                    required: [] as string[]
                };

                // Process workflows until queue is empty
                while (workflowQueue.length > 0) {
                    const currentWorkflowId = workflowQueue.shift()!;
                    
                    // Skip if already processed
                    if (processedWorkflows.has(currentWorkflowId)) {
                        continue;
                    }
                    
                    const workflow = await this.workflowRepository.findOne({
                        where: { workflowId: currentWorkflowId },
                        relations: [
                            'workflowCategory',
                            'workflowActivities',
                            'workflowActivities.activity',
                            'workflowActivities.subWorkflow',
                            'workflowActivities.subWorkflow.workflowActivities',
                            'workflowActivities.subWorkflow.workflowActivities.activity'
                        ],
                    });

                    if (!workflow) {
                        throw new Error(`Workflow with ID ${currentWorkflowId} not found`);
                    }

                    // Merge ENV schema
                    if (workflow.workflowENVInputSchema) {
                        mergedENVinputSchema.properties = {
                            ...mergedENVinputSchema.properties,
                            ...workflow.workflowENVInputSchema.properties
                        };
                        if (workflow.workflowENVInputSchema.required) {
                            mergedENVinputSchema.required = [
                                ...new Set([
                                    ...mergedENVinputSchema.required,
                                    ...workflow.workflowENVInputSchema.required
                                ])
                            ];
                        }
                    }

                    // Process activities and sub-workflows
                    for (const workflowActivity of workflow.workflowActivities) {
                        // Handle activity
                        if (workflowActivity.activity) {
                            const activityCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                                sourceCode: workflowActivity.activity.activityCode,
                                newFunctionName: workflowActivity.activity.activityExternalName,
                                functionType: OB1TSValidation.FunctionType.ACTIVITY
                            });
                            mergedActivityCode += activityCode + '\n';
                            uniqueActivityNames.add(workflowActivity.activity.activityExternalName);

                            // Merge activity ENV schema
                            if (workflowActivity.activity.activityENVInputSchema) {
                                mergedENVinputSchema.properties = {
                                    ...mergedENVinputSchema.properties,
                                    ...workflowActivity.activity.activityENVInputSchema.properties
                                };
                                if (workflowActivity.activity.activityENVInputSchema.required) {
                                    mergedENVinputSchema.required = [
                                        ...new Set([
                                            ...mergedENVinputSchema.required,
                                            ...workflowActivity.activity.activityENVInputSchema.required
                                        ])
                                    ];
                                }
                            }

                            // Add activity imports
                            if (workflowActivity.activity.activityImports) {
                                workflowActivity.activity.activityImports.forEach(imp => uniqueImports.add(imp));
                            }
                        }

                        // Queue sub-workflow for processing if it exists and hasn't been processed
                        if (workflowActivity.subWorkflow && !processedWorkflows.has(workflowActivity.subWorkflow.workflowId)) {
                            workflowQueue.push(workflowActivity.subWorkflow.workflowId);
                        }
                    }

                    // Mark current workflow as processed
                    processedWorkflows.add(currentWorkflowId);
                }

                // Process only the main workflow's code
                let updatedWorkflowCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                    sourceCode: mainWorkflow.workflowCode,
                    newFunctionName: mainWorkflow.workflowExternalName,
                    functionType: OB1TSValidation.FunctionType.WORKFLOW
                });
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
                    mergedActivityCode
                );

                return {
                    workflow: mainWorkflow,
                    updatedWorkflowCode: updatedWorkflowCode,
                    updatedActivityCode: mergedActivityCode,
                    uniqueImports: uniqueImports,
                };
            } catch (error) {
                this.logger.error(`Failed to pass initial validation for workflow:\n${JSON.stringify(error, null, 2)}`);
                throw new BadRequestException({
                    message: 'Failed to pass initial validation for workflow',
                    errorSuperDetails: { ...error },
                });
            }
        }

        // EXPERIMENTAL
        public async validateMultipleWorkflowAndPrepareCodeForExecution(request: OB1Workflow.WorkflowValidationRequestMultiple): Promise<OB1Workflow.WorkflowValidationResponse> {
            try {
                const { workflowId, workflowENVInputVariables } = request;
                const mainWorkflow = await this.workflowRepository.findOne({
                    where: { workflowId: workflowId },
                    relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
                });

                const workflows = await this.workflowRepository.find({
                    where: { workflowId: In(request.workflowIds) },
                    relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
                });

                if (!mainWorkflow) {
                    throw new Error(`Workflow with ID ${workflowId} not found`);
                }

                let isCached : boolean = false;
                const redisActivityKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:activityCode`;
                const redisWorkflowKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}`;
                const redisImportKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${mainWorkflow.workflowExternalName}:imports`;

                const redisExistingActivityCode = await this.redisService.get(redisActivityKey);
                const redisExistingWorkflowCode = await this.redisService.get(redisWorkflowKey);
                const redisExistingImports = await this.redisService.getSet(redisImportKey);

                let mergedCode : string = '';
                let mergedWorkflowCode : string = '';
                let mergedActivityCode : string = '';
                let uniqueImports = new Set<string>();
                let updatedWorkflowCode : string = '';
                let mergedENVinputSchema = {
                    type: 'object',
                    properties: {
                        ...mainWorkflow.workflowENVInputSchema.properties
                    },
                    required: [...(mainWorkflow.workflowENVInputSchema.required || [])]
                };

                if(redisExistingActivityCode && redisExistingWorkflowCode)
                {
                    isCached = true;
                    mergedCode = redisExistingActivityCode + redisExistingWorkflowCode;
                    mergedWorkflowCode = redisExistingWorkflowCode;
                    mergedActivityCode = redisExistingActivityCode;
                    updatedWorkflowCode = redisExistingWorkflowCode;
                    uniqueImports = redisExistingImports ? new Set(redisExistingImports) : new Set<string>();
                    mainWorkflow.workflowActivities.forEach(activity => {
                        const activityENVSchema = activity.activity.activityENVInputSchema;
                        if (activityENVSchema) {
                            // Merge properties
                            mergedENVinputSchema.properties = {
                                ...mergedENVinputSchema.properties,
                                ...activityENVSchema.properties
                            };
                            
                            // Merge required fields if they exist
                            if (activityENVSchema.required) {
                                mergedENVinputSchema.required = [
                                    ...new Set([
                                        ...mergedENVinputSchema.required,
                                            ...activityENVSchema.required
                                    ])
                                ];
                            }
                        }
                    }); 
                }
                else
                {   
                    updatedWorkflowCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                        sourceCode: mainWorkflow.workflowCode, newFunctionName: mainWorkflow.workflowExternalName, functionType: OB1TSValidation.FunctionType.WORKFLOW
                    });
                    mergedWorkflowCode = updatedWorkflowCode;
                    workflows.forEach(workflow => {
                        mergedWorkflowCode += this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                            sourceCode: workflow.workflowCode, newFunctionName: workflow.workflowExternalName, functionType: OB1TSValidation.FunctionType.WORKFLOW
                        });
                        workflow.workflowActivities.forEach(activity => {
                            const activityENVSchema = activity.activity.activityENVInputSchema;
                            const activityCode = activity.activity.activityCode;
                            const updatedActivityCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                                sourceCode: activityCode, newFunctionName: activity.activity.activityExternalName, functionType: OB1TSValidation.FunctionType.ACTIVITY
                            });
                            mergedCode += updatedActivityCode + '\n';
                            mergedActivityCode += updatedActivityCode + '\n';
                            if (activityENVSchema) {
                                // Merge properties
                                mergedENVinputSchema.properties = {
                                    ...mergedENVinputSchema.properties,
                                    ...activityENVSchema.properties
                                };
                                
                                // Merge required fields if they exist
                                if (activityENVSchema.required) {
                                    mergedENVinputSchema.required = [
                                        ...new Set([
                                            ...mergedENVinputSchema.required,
                                                ...activityENVSchema.required
                                        ])
                                    ];
                                }
                            }
    
                            if (activity.activity.activityImports) {
                                activity.activity.activityImports.forEach(imp => uniqueImports.add(imp));
                            }
                        });     
                    })
                    mainWorkflow.workflowActivities.forEach(activity => {
                        const activityENVSchema = activity.activity.activityENVInputSchema;
                        const activityCode = activity.activity.activityCode;
                        const updatedActivityCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                            sourceCode: activityCode, newFunctionName: activity.activity.activityExternalName, functionType: OB1TSValidation.FunctionType.ACTIVITY
                        });
                        mergedCode += updatedActivityCode + '\n';
                        mergedActivityCode += updatedActivityCode + '\n';
                        if (activityENVSchema) {
                            // Merge properties
                            mergedENVinputSchema.properties = {
                                ...mergedENVinputSchema.properties,
                                ...activityENVSchema.properties
                            };
                            
                            // Merge required fields if they exist
                            if (activityENVSchema.required) {
                                mergedENVinputSchema.required = [
                                    ...new Set([
                                        ...mergedENVinputSchema.required,
                                            ...activityENVSchema.required
                                    ])
                                ];
                            }
                        }

                        if (activity.activity.activityImports) {
                            activity.activity.activityImports.forEach(imp => uniqueImports.add(imp));
                        }
                    }); 
                }
                updatedWorkflowCode = this.tsValidationOb1Service.validateAndConsolidateWorkflowImports(mergedWorkflowCode);
                // Validate ENV input variables against the merged ENV schema
                // const inputValidationResult = this.tsValidationOb1Service.validateInputAgainstInputSchema(mergedENVinputSchema, workflowENVInputVariables);
                
                
                // Compile TypeScript for validation
                // await this.tsValidationOb1Service.compileTypeScriptCheckForWorkflowExecution(updatedWorkflowCode, mergedActivityCode);                
                
                
                // Validate ENV input variables against the merged ENV schema
                // // Merge ENV schemas from all activities

                const response: OB1Workflow.WorkflowValidationResponse = {
                    workflow: mainWorkflow,
                    updatedWorkflowCode: updatedWorkflowCode,
                    updatedActivityCode: mergedActivityCode,
                    uniqueImports: uniqueImports,
                }
                return response;
            } catch (error) {
                this.logger.error(`Failed to pass initial validation for workflow:\n${JSON.stringify(error, null, 2)}`);
                throw new BadRequestException({
                    message: 'Failed to pass initial validation for workflow',
                    errorSuperDetails: { ...error },
                });
            }
        }
        //#endregion

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

                if(isTTLUpdated){; 
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
    }


    //#region  DEPRECATED

        // moved to ts-validation-ob1.service.ts for general purpose
        // private replaceWorkflowFunctionName(sourceCode: string, newFunctionName: string): string {
        //     // Create source file from the workflow code
        //     const sourceFile = ts.createSourceFile(
        //         'workflow.ts',
        //         sourceCode,
        //         ts.ScriptTarget.Latest,
        //         true
        //     );

        //     function handleFunctionNameReplacement(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
        //         if (node.name && node.name.text === 'myWorkflow') {
        //             return ts.factory.updateFunctionDeclaration(
        //                 node,
        //                 node.modifiers,
        //                 node.asteriskToken,
        //                 ts.factory.createIdentifier(newFunctionName),
        //                 node.typeParameters,
        //                 node.parameters,
        //                 node.type,
        //                 node.body
        //             );
        //         }
        //         return node;
        //     }

        //     function handleExportDefaultModifier(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
        //         const hasExportDefault = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword) &&
        //                                 node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
                
        //         if (hasExportDefault) {
        //             const modifiers = node.modifiers.filter(
        //                 mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
        //             );

        //             return ts.factory.updateFunctionDeclaration(
        //                 node,
        //                 modifiers,
        //                 node.asteriskToken,
        //                 node.name,
        //                 node.typeParameters,
        //                 node.parameters,
        //                 node.type,
        //                 node.body
        //             );
        //         }
        //         return node;
        //     }

        //     function findAndReplaceFunctionName(node: ts.Node): ts.Node {
        //         if (ts.isFunctionDeclaration(node)) {
        //             const nameReplacement = handleFunctionNameReplacement(node);
        //             const exportModification = handleExportDefaultModifier(nameReplacement);
        //             return exportModification;
        //         }
        //         return node;
        //     }

        //     // Create transformer
        //     const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
        //         return (rootNode: T) => {
        //             function visit(node: ts.Node): ts.Node {
        //                 node = findAndReplaceFunctionName(node);
        //                 return ts.visitEachChild(node, visit, context);
        //             }
        //             return ts.visitNode(rootNode, visit);
        //         };
        //     };

        //     // Apply transformation
        //     const result = ts.transform(sourceFile, [transformer]);
        //     const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        //     const transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

        //     return transformedCode;
        // }


        // private async validateWorkflowENVInputVariablesAgainstMergedENVSchema(request: OB1Workflow.WorkflowEnvValidationRequest): Promise<boolean> {
        //     try {
        //         const { workflowENVInputVariables, activities, workflowENVInputSchema } = request;

        //     let mergedENVSchema = {
        //         type: 'object',
        //         properties: {
        //             ...workflowENVInputSchema.properties
        //         },
        //         required: [...(workflowENVInputSchema.required || [])]
        //     };

        //     // Merge ENV schemas from all activities
        //     activities.forEach(activity => {
        //         const activityENVSchema = activity.activityENVInputSchema;
        //         if (activityENVSchema) {
        //             // Merge properties
        //             mergedENVSchema.properties = {
        //                 ...mergedENVSchema.properties,
        //                 ...activityENVSchema.properties
        //             };
                    
        //             // Merge required fields if they exist
        //             if (activityENVSchema.required) {
        //                 mergedENVSchema.required = [
        //                     ...new Set([
        //                         ...mergedENVSchema.required,
        //                             ...activityENVSchema.required
        //                         ])
        //                     ];
        //                 }
        //             }
        //         });

        //         return this.tsValidationOb1Service.validateInputAgainstInputSchema(mergedENVSchema, workflowENVInputVariables);
        //     } catch (error) {
        //         this.logger.error(`Failed to validate workflow ENV input variables against ENV input schema:\n${JSON.stringify(error, null, 2)}`);
        //         throw new BadRequestException({
        //             message: 'Failed to validate workflow ENV input variables against ENV input schema',
        //             errorSuperDetails: { ...error },
        //         });
        //     }
        // }

        // private async validateENV(request: OB1Workflow.WorkflowEnvValidationRequest): Promise<boolean> {
        //     const { workflowENVInputVariables, workflowENVInputSchema } = request;
            
        //     return this.tsValidationOb1Service.validateInputAgainstInputSchema(workflowENVInputSchema, workflowENVInputVariables);
        // }
    //#endregion