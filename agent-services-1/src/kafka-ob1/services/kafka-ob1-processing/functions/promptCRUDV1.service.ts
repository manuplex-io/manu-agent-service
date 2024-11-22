import { Injectable, ValidationPipe, Logger } from '@nestjs/common';
import { PromptV1Service } from '../../../../prompts/services/promptV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDRoute,
} from '../../../interfaces/promptCRUD.interfaces';

import {
    CreatePromptDto,
    UpdatePromptDto,
    ListPromptsQueryDto,
    ExecutePromptwithUserPromptDto,
    ExecutePromptWithUserPromptNoToolExec,
    ExecutePromptwithoutUserPromptDto,
    ExecutePromptWithoutUserPromptNoToolExec,
    ExecutionLogsQueryDto,
} from '../../../../prompts/interfaces/prompt.interfaces';

import { generateDefaultErrorMessageResponseValue } from '../../../interfaces/ob1-message.interfaces';

@Injectable()
export class PromptCRUDV1 {
    private readonly logger = new Logger(PromptCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(private readonly promptV1Service: PromptV1Service) {
        this.validationPipe = new ValidationPipe({ transform: true, whitelist: true });
    }

    async CRUDRoutes(functionInput: CRUDFunctionInputExtended) {
        try {

            const { CRUDOperationName: operation, CRUDRoute: route, CRUDBody, routeParams, queryParams, tracing, requestMetadata } = functionInput;

            switch (`${operation}-${route}`) {
                case `${CRUDOperationName.GET}-${CRUDRoute.LIST_PROMPTS}`: {
                    const validatedQuery = await this.validationPipe.transform(
                        queryParams,
                        { metatype: ListPromptsQueryDto, type: 'query' }
                    );
                    return await this.promptV1Service.listPrompts(validatedQuery);
                }

                case `${CRUDOperationName.GET}-${CRUDRoute.GET_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        return generateDefaultErrorMessageResponseValue(
                            400,
                            'Validation failed: promptId is required',
                            { routeParams },
                        );
                    }
                    return await this.promptV1Service.getPrompt(routeParams.promptId);
                }

                case `${CRUDOperationName.POST}-${CRUDRoute.CREATE_PROMPT}`: {
                    this.logger.log(`CRUDBody: ${JSON.stringify(CRUDBody)}`);
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBody,
                        { metatype: CreatePromptDto, type: 'body' }
                    );
                    this.logger.log(`Validated Body: ${JSON.stringify(validatedBody)}`);
                    return await this.promptV1Service.createPrompt(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDRoute.UPDATE_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        return generateDefaultErrorMessageResponseValue(
                            400,
                            'Validation failed: promptId is required',
                            { routeParams },
                        );
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBody,
                        { metatype: UpdatePromptDto, type: 'body' }
                    );
                    return await this.promptV1Service.updatePrompt(routeParams.promptId, validatedBody);
                }

                case `${CRUDOperationName.POST}-${CRUDRoute.EXECUTE_WITH_USER_PROMPT}`: {
                    if (!routeParams?.promptId) {
                        return generateDefaultErrorMessageResponseValue(
                            400,
                            'Validation failed: promptId is required',
                            { routeParams },
                        );
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBody,
                        { metatype: ExecutePromptwithUserPromptDto, type: 'body' }
                    );

                    const request: ExecutePromptWithUserPromptNoToolExec = {
                        promptId: routeParams.promptId,
                        userPrompt: validatedBody.userPrompt,
                        systemPromptVariables: validatedBody.systemPromptVariables,
                        llmConfig: validatedBody.llmConfig,
                        tracing: tracing,
                        requestMetadata: requestMetadata
                    };
                    return await this.promptV1Service.executePromptWithUserPromptNoToolExec(request);
                }

                case `${CRUDOperationName.POST}-${CRUDRoute.EXECUTE_WITHOUT_USER_PROMPT}`: {

                    if (!routeParams?.promptId) {
                        return generateDefaultErrorMessageResponseValue(
                            400,
                            'Validation failed: promptId is required',
                            { routeParams },
                        );
                    }

                    const validatedBody = await this.validationPipe.transform(
                        CRUDBody,
                        { metatype: ExecutePromptwithoutUserPromptDto, type: 'body' }
                    );

                    const request: ExecutePromptWithoutUserPromptNoToolExec = {
                        promptId: routeParams.promptId,
                        userPromptVariables: validatedBody.userPromptVariables,
                        systemPromptVariables: validatedBody.systemPromptVariables,
                        llmConfig: validatedBody.llmConfig,
                        tracing: tracing,
                        requestMetadata: requestMetadata
                    };

                    this.logger.log(`CRUDRoute.EXECUTE_WITHOUT_USER_PROMPT: request:\n${JSON.stringify(request, null, 2)}`);

                    return await this.promptV1Service.executePromptWithoutUserPromptNoToolExec(request);
                }

                case `${CRUDOperationName.GET}-${CRUDRoute.GET_EXECUTION_LOGS}`: {
                    if (!routeParams?.promptId) {
                        return generateDefaultErrorMessageResponseValue(
                            400,
                            'Validation failed: promptId is required',
                            { routeParams },
                        );
                    }
                    const validatedQuery = await this.validationPipe.transform(
                        queryParams,
                        { metatype: ExecutionLogsQueryDto, type: 'query' }
                    );
                    return await this.promptV1Service.getExecutionLogs(routeParams.promptId, validatedQuery);
                }

                default:
                    return generateDefaultErrorMessageResponseValue(
                        400,
                        `Invalid operation: ${operation}-${route}`,
                        { functionInput },
                    );
            }
        } catch (error) {
            this.logger.error(`Error processing CRUD operation`, error);

            return generateDefaultErrorMessageResponseValue(
                500,
                'Error processing CRUD operation',
                { errorMessage: error.message, stack: error.stack },
            );
        }
    }
}
