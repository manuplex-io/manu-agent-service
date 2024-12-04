// /src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/workflowCRUDV1.service.ts

import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { WorkflowManagementV1Service } from 'src/workflows/services/workflowManagementV1.service';
import { WorkflowTestingV1Service } from 'src/workflows/services/workflowTestingV1.service';
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
            } = functionInput;

            // Retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // Add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
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
                    return await this.workflowCategoryService.getCategories();
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
