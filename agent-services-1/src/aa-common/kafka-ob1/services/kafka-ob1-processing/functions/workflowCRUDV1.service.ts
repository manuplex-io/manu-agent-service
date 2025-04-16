// /src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/workflowCRUDV1.service.ts

import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { WorkflowManagementV1Service } from 'src/workflows/services/workflowManagementV1.service';
import { WorkflowTestingV1Service } from 'src/workflows/services/testing/workflowTestingV1.service';
import { WorkflowExecutionV1Service } from 'src/workflows/services/execution/workflowExecutionV1.service';
import { WorkflowExecutionV2Service } from 'src/workflows/services/execution/workflowExecutionV2.service';
import { WorkflowCategoryManagementV1Service } from 'src/workflows/services/workflowCategoryManagementV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDWorkflowRoute,
} from '../../../interfaces/CRUD.interfaces';
import { OB1WorkflowDto as WorkflowDto } from 'src/workflows/Dto/workflow.Dto';
import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class WorkflowCRUDV1 {
    private readonly logger = new Logger(WorkflowCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly workflowManagementService: WorkflowManagementV1Service,
        private readonly workflowTestingService: WorkflowTestingV1Service,
        private readonly workflowCategoryService: WorkflowCategoryManagementV1Service,
        private readonly workflowExecutionService: WorkflowExecutionV1Service,
        private readonly workflowExecutionV2Service: WorkflowExecutionV2Service,
    ) {
        this.validationPipe = new ValidationPipe({
            transform: true,
            whitelist: true,
            // forbidNonWhitelisted: true, // Uncomment to raise error if extra properties not in the DTO
            validationError: {
                target: false, // Hides the original object in error response
                value: true,   // Shows the value causing the error
            },
            exceptionFactory: (errors) => {
                const validationErrorMessages = errors.map((error) => ({
                    errorProperty: error.property,
                    constraints: error.constraints,
                    value: error.value,
                }));
                this.logger.error(`Validation Pipe OUTPUT: ${JSON.stringify(validationErrorMessages, null, 2)}`);
                return new BadRequestException({
                    message: 'Validation failed',
                    details: validationErrorMessages,
                });
            },
        });
    }

    async CRUDWorkflowRoutes(functionInput: CRUDFunctionInputExtended) {
        try {
            const {
                CRUDOperationName: operation,
                CRUDRoute: route,
                CRUDBody,
                routeParams,
                queryParams,
                requestMetadata,
            } = functionInput;

            // Retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // Add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
                workflowExecutionConfig: { requestMetadata },
            };

            this.logger.debug(`CRUDWorkflowRoutes: functionInput:\n${JSON.stringify(functionInput, null, 2)}`);
            this.logger.debug(`CRUDWorkflowRoutes: CRUDBodyWithConsultantPayload:\n${JSON.stringify(CRUDBodyWithConsultantPayload, null, 2)}`);
            switch (`${operation}-${route}`) {
                // Workflow Routes
                case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.LIST_WORKFLOWS}`: {
                    const updatedQueryParams = {
                        ...queryParams,
                        consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                        personId: consultantPayload?.personId,
                        limit: queryParams.limit ? Number(queryParams.limit) : undefined,
                        page: queryParams.page ? Number(queryParams.page) : undefined
                    };
                    const validatedQuery = await this.validationPipe.transform(
                        updatedQueryParams,
                        { metatype: WorkflowDto.WorkflowQueryParamsDto, type: 'query' },
                    );
                    return await this.workflowManagementService.getWorkflows(validatedQuery);
                }

                case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.GET_WORKFLOW}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.workflowManagementService.getWorkflow(routeParams.workflowId);
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.CREATE_WORKFLOW}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.CreateWorkflowDto, type: 'body' },
                    );
                    return await this.workflowManagementService.createWorkflow(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDWorkflowRoute.UPDATE_WORKFLOW}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.UpdateWorkflowDto, type: 'body' },
                    );
                    return await this.workflowManagementService.updateWorkflow(routeParams.workflowId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDWorkflowRoute.DELETE_WORKFLOW}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.workflowManagementService.deleteWorkflow(routeParams.workflowId);
                }

                // Workflow Category Routes
                case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.LIST_CATEGORIES}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.GetCategoryDto, type: 'body' }
                    );
                    return await this.workflowCategoryService.getCategories(validatedBody);
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.CREATE_CATEGORY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.CreateCategoryDto, type: 'body' },
                    );
                    return await this.workflowCategoryService.createCategory(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDWorkflowRoute.UPDATE_CATEGORY}`: {
                    if (!routeParams?.workflowCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.UpdateCategoryDto, type: 'body' },
                    );
                    return await this.workflowCategoryService.updateCategory(routeParams.workflowCategoryId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDWorkflowRoute.DELETE_CATEGORY}`: {
                    if (!routeParams?.workflowCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.workflowCategoryService.deleteCategory(routeParams.workflowCategoryId);
                }

                // Workflow Testing Routes
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.TEST_WORKFLOW}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const workflowInput = CRUDBodyWithConsultantPayload;
                    return await this.workflowTestingService.testAnyWorkflowWithWorkflowId(
                        routeParams.workflowId,
                        workflowInput,
                    );
                }

                // Validate Workflow Only (without saving)
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.VALIDATE_WORKFLOW_ONLY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.CreateWorkflowDto, type: 'body' },
                    );
                    return await this.workflowTestingService.validateAnyWorkflow(validatedBody);
                }

                //Execute Workflow
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }


                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionService.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'sync',
                    });
                }
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_SYNC}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionService.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        workflowScheduleConfig: validatedBody?.workflowScheduleConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'sync',
                    });
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_ASYNC}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionService.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'async',
                    });
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_SCHEDULED}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionService.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        workflowScheduleConfig: validatedBody?.workflowScheduleConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'scheduled',
                    });
                }
                
                // EXPERIMENTAL
                // case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_ASYNC_MULTIPLE}`: {
                //     debugger;
                //     if (!routeParams?.workflowId) {
                //         throw new BadRequestException({
                //             message: 'Validation failed: workflowId is required',
                //             details: { routeParams },
                //         });
                //     }
                //     const validatedBody = await this.validationPipe.transform(
                //         CRUDBodyWithConsultantPayload,
                //         { metatype: WorkflowDto.ExecuteWorkflowAsyncMultipleDto, type: 'body' },
                //     );
                //     return await this.workflowExecutionService.ExecuteAnyWorkflowWithWorkflowId({
                //         workflowId: routeParams.workflowId,
                //         workflowInputVariables: validatedBody.workflowInputVariables,
                //         workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                //         workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                //         consultantOrgShortName: validatedBody.consultantOrgShortName,
                //         personId: validatedBody.personId,
                //         requestId: functionInput.requestId,
                //         requestMetadata: functionInput.requestMetadata,
                //         workflowExecutionType: 'asyncMultiple',
                //         workflowIds: validatedBody.workflowIds,
                //     });
                // }

                case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.GET_WORKFLOW_EXECUTION_STATUS}`: {
                    if (!routeParams?.temporalWorkflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: temporalWorkflowId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.workflowExecutionService.getWorkflowExecutionStatus(routeParams.temporalWorkflowId);
                }
                // case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.GET_WORKFLOW_CODE}`: {
                //     if (!queryParams?.workflowExternalName) {
                //         throw new BadRequestException({
                //             message: 'Validation failed: workflowExternalName is required',
                //             details: { queryParams },
                //         });
                //     }
                //     return await this.workflowExecutionService.loadWorkflowCode(queryParams.workflowExternalName);
                // }

                //Execute Workflow
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_V2}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }


                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionV2Service.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'sync',
                    });
                }
                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_SYNC_V2}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionV2Service.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        workflowScheduleConfig: validatedBody?.workflowScheduleConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'sync',
                    });
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_ASYNC_V2}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionV2Service.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'async',
                    });
                }

                case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_WORKFLOW_SCHEDULED_V2}`: {
                    if (!routeParams?.workflowId) {
                        throw new BadRequestException({
                            message: 'Validation failed: workflowId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                    );
                    return await this.workflowExecutionV2Service.ExecuteAnyWorkflowWithWorkflowId({
                        workflowId: routeParams.workflowId,
                        workflowInputVariables: validatedBody.workflowInputVariables,
                        workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                        workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                        workflowScheduleConfig: validatedBody?.workflowScheduleConfig,
                        consultantOrgShortName: validatedBody.consultantOrgShortName,
                        personId: validatedBody.personId,
                        requestId: functionInput.requestId,
                        requestMetadata: functionInput.requestMetadata,
                        workflowExecutionType: 'scheduled',
                    });
                }

                // case `${CRUDOperationName.POST}-${CRUDWorkflowRoute.EXECUTE_ACTIVITY_AS_WORKFLOW_V2}`: {
                //     if (!routeParams?.activityId) {
                //         throw new BadRequestException({
                //             message: 'Validation failed: activityId is required',
                //             details: { routeParams },
                //         });
                //     }
                //     const validatedBody = await this.validationPipe.transform(
                //         CRUDBodyWithConsultantPayload,
                //         { metatype: WorkflowDto.ExecuteWorkflowDto, type: 'body' },
                //     );
                //     return await this.workflowExecutionV2Service.executeActivityAsWorkflow({
                //         activityId: routeParams.activityId,
                //         workflowInputVariables: validatedBody.workflowInputVariables,
                //         workflowENVInputVariables: validatedBody?.workflowENVInputVariables,
                //         workflowExecutionConfig: validatedBody?.workflowExecutionConfig,
                //         consultantOrgShortName: validatedBody.consultantOrgShortName,
                //         personId: validatedBody.personId,
                //         requestId: functionInput.requestId,
                //         requestMetadata: functionInput.requestMetadata,
                //     });
                // }


                // case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.GET_WORKFLOW_EXECUTION_STATUS_V2}`: {
                //     if (!routeParams?.temporalWorkflowId) {
                //         throw new BadRequestException({
                //             message: 'Validation failed: temporalWorkflowId is required',
                //             details: { routeParams },
                //         });
                //     }
                //     return await this.workflowExecutionV2Service.getWorkflowExecutionStatus(routeParams.temporalWorkflowId);
                // }
                // case `${CRUDOperationName.GET}-${CRUDWorkflowRoute.GET_WORKFLOW_CODE_V2}`: {
                //     if (!queryParams?.workflowExternalName) {
                //         throw new BadRequestException({
                //             message: 'Validation failed: workflowExternalName is required',
                //             details: { queryParams },
                //         });
                //     }
                //     return await this.workflowExecutionV2Service.loadWorkflowCode(queryParams.workflowExternalName);
                // }


                default:
                    throw new BadRequestException({
                        message: `Invalid Workflow operation: ${operation} - ${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {
            this.logger.error(`Error processing workflow CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
