import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { PromptManagementV1Service } from '../../../../../prompts/services/promptManagementV1.service';
import { PromptExecutionV1Service } from '../../../../../prompts/services/promptExecutionV1.service';
import { PromptCategoryManagementV1Service } from '../../../../../prompts/services/promptCategoryManagementV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDPromptRoute,
} from '../../../interfaces/CRUD.interfaces';

import { OB1PromptDto } from 'src/prompts/Dto/prompts.Dto';

import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class PromptCRUDV1 {
    private readonly logger = new Logger(PromptCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly promptManagementV1Service: PromptManagementV1Service,
        private readonly promptExecutionV1Service: PromptExecutionV1Service,
        private readonly promptCategoryManagementV1Service: PromptCategoryManagementV1Service,
    ) {
        this.validationPipe = new ValidationPipe({ transform: true, whitelist: true });
    }

    async CRUDPromptRoutes(functionInput: CRUDFunctionInputExtended) {
        try {

            const { CRUDOperationName: operation, CRUDRoute: route, CRUDBody, routeParams, queryParams, requestId, requestMetadata } = functionInput;

            // retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
            };


            switch (`${operation}-${route}`) {
                case `${CRUDOperationName.GET}-${CRUDPromptRoute.LIST_PROMPTS}`: {
                    const updatedQueryParams = {
                        ...queryParams, consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                        personId: consultantPayload?.personId,
                    };
                    const validatedQuery = await this.validationPipe.transform(
                        updatedQueryParams,
                        { metatype: OB1PromptDto.ListPromptsQueryDto, type: 'query' }
                    );
                    return await this.promptManagementV1Service.getPrompts(validatedQuery);
                }

                case `${CRUDOperationName.GET}-${CRUDPromptRoute.GET_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        throw new BadRequestException({
                            message: 'Validation failed: promptId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.promptManagementV1Service.getPrompt(routeParams.promptId);
                }

                case `${CRUDOperationName.POST}-${CRUDPromptRoute.CREATE_PROMPT}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1PromptDto.CreatePromptDto, type: 'body' }
                    );
                    return await this.promptManagementV1Service.createPrompt(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDPromptRoute.UPDATE_PROMPT}`: {

                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1PromptDto.UpdatePromptDto, type: 'body' }
                    );
                    return await this.promptManagementV1Service.updatePrompt(routeParams.promptId, validatedBody);
                }
                case `${CRUDOperationName.DELETE}-${CRUDPromptRoute.DELETE_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        throw new BadRequestException({
                            message: 'Validation failed: promptId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.promptManagementV1Service.deletePrompt(routeParams.promptId);
                }

                case `${CRUDOperationName.POST}-${CRUDPromptRoute.EXECUTE_WITH_USER_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        throw new BadRequestException({
                            message: 'Validation failed: promptId is required',
                            details: { routeParams },
                        });
                    }
                    const newCRUDBody = {
                        ...CRUDBody,
                        ...routeParams,
                        requestId: requestId,
                        requestMetadata: requestMetadata
                    };

                    const validatedBody = await this.validationPipe.transform(
                        newCRUDBody,
                        { metatype: OB1PromptDto.ExecutePromptWithUserPromptDto, type: 'body' }
                    );

                    // const request: OB1PromptDto.ExecutePromptWithUserPromptDto = {
                    //     promptId: routeParams.promptId,
                    //     userPrompt: validatedBody.userPrompt,
                    //     systemPromptVariables: validatedBody.systemPromptVariables,
                    //     llmConfig: validatedBody.llmConfig,
                    //     requestId: validatedBody.requestId,
                    //     requestMetadata: requestMetadata
                    // };
                    return await this.promptExecutionV1Service.executePromptWithUserPromptWithTools(validatedBody);
                }

                case `${CRUDOperationName.POST}-${CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        throw new BadRequestException({
                            message: 'Validation failed: promptId is required',
                            details: { routeParams },
                        });
                    }
                    const newCRUDBody = {
                        ...CRUDBody,
                        ...routeParams,
                        requestId: requestId,
                        requestMetadata: requestMetadata
                    };
                    const validatedBody = await this.validationPipe.transform(
                        newCRUDBody,
                        { metatype: OB1PromptDto.ExecutePromptWithoutUserPromptDto, type: 'body' }
                    );

                    // const request: OB1PromptDto.ExecutePromptWithoutUserPromptNoToolExec = {
                    //     promptId: routeParams.promptId,
                    //     userPromptVariables: validatedBody.userPromptVariables,
                    //     systemPromptVariables: validatedBody.systemPromptVariables,
                    //     llmConfig: validatedBody.llmConfig,
                    //     tracing: tracing,
                    //     requestMetadata: requestMetadata
                    // };

                    // this.logger.log(`CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT: request:\n${JSON.stringify(request, null, 2)}`);
                    return await this.promptExecutionV1Service.executePromptWithoutUserPromptWithTools(validatedBody);
                }

                case `${CRUDOperationName.GET}-${CRUDPromptRoute.GET_EXECUTION_LOGS}`: {
                    if (!routeParams?.promptId) {
                        throw new BadRequestException({
                            message: 'Validation failed: promptId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedQuery = await this.validationPipe.transform(
                        queryParams,
                        { metatype: OB1PromptDto.ExecutionLogsQueryDto, type: 'query' }
                    );
                    return await this.promptExecutionV1Service.getExecutionLogs(routeParams.promptId, validatedQuery);
                }
                case `${CRUDOperationName.POST}-${CRUDPromptRoute.CREATE_CATEGORY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1PromptDto.CreateCategory, type: 'body' }
                    );
                    return await this.promptCategoryManagementV1Service.createCategory(validatedBody);
                }

                case `${CRUDOperationName.GET}-${CRUDPromptRoute.LIST_CATEGORIES}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1PromptDto.GetCategory, type: 'body' }
                    );
                    return await this.promptCategoryManagementV1Service.getCategories(validatedBody);
                }

                default:
                    throw new BadRequestException({
                        message: `Invalid prompt operation: ${operation}-${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {
            this.logger.log(`Error processing Prompt CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
