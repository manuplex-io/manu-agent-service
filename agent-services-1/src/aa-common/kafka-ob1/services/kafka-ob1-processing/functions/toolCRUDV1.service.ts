// /src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/toolCRUDV1.service.ts
import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ToolsManagementV1Service } from 'src/tools/services/toolsManagementV1.service';
import { ToolsExecutionV1Service } from 'src/tools/services/toolsExecutionV1.service';
import { ToolsCatogoryManagementV1Service } from 'src/tools/services/toolsCatogoryManagementV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDToolRoute,
} from '../../../interfaces/CRUD.interfaces';
import { OB1ToolDto } from 'src/tools/Dto/tool.Dto';

import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class ToolCRUDV1 {
    private readonly logger = new Logger(ToolCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly toolsManagementService: ToolsManagementV1Service,
        private readonly toolsExecutionService: ToolsExecutionV1Service,
        private readonly toolsCategoryService: ToolsCatogoryManagementV1Service,
    ) {
        this.validationPipe = new ValidationPipe({ transform: true, whitelist: true });
    }

    async CRUDToolRoutes(functionInput: CRUDFunctionInputExtended) {
        try {
            const { CRUDOperationName: operation, CRUDRoute: route, CRUDBody, routeParams, queryParams } = functionInput;

            // retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
            };

            switch (`${operation}-${route}`) {
                // Tools Routes
                case `${CRUDOperationName.GET}-${CRUDToolRoute.LIST_TOOLS}`: {
                    const updatedQueryParams = {
                        ...queryParams, consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                        personId: consultantPayload?.personId,
                    };
                    const validatedQuery = await this.validationPipe.transform(
                        updatedQueryParams,
                        { metatype: OB1ToolDto.ToolQueryParamsDto, type: 'query' }
                    );
                    return await this.toolsManagementService.getTools(validatedQuery);
                }

                case `${CRUDOperationName.GET}-${CRUDToolRoute.GET_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.toolsManagementService.getTool(routeParams.toolId);
                }

                case `${CRUDOperationName.GET}-${CRUDToolRoute.GET_FULL_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.toolsManagementService.getFullTool(routeParams.toolId);
                }

                case `${CRUDOperationName.POST}-${CRUDToolRoute.CREATE_TOOL}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.CreateToolDto, type: 'body' }
                    );
                    return await this.toolsManagementService.createTool(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDToolRoute.UPDATE_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.UpdateToolDto, type: 'body' }
                    );
                    return await this.toolsManagementService.updateTool(routeParams.toolId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDToolRoute.DELETE_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.toolsManagementService.deleteTool(routeParams.toolId);
                }

                // Category Routes
                case `${CRUDOperationName.GET}-${CRUDToolRoute.LIST_CATEGORIES}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.GetCategoryDto, type: 'body' }
                    );
                    return await this.toolsCategoryService.getToolCategories(validatedBody);
                }

                case `${CRUDOperationName.POST}-${CRUDToolRoute.CREATE_CATEGORY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.CreateCategoryDto, type: 'body' }
                    );
                    return await this.toolsCategoryService.createToolCategory(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDToolRoute.UPDATE_CATEGORY}`: {
                    if (!routeParams?.toolCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.UpdateCategoryDto, type: 'body' }
                    );
                    return await this.toolsCategoryService.updateToolCategory(routeParams.toolId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDToolRoute.DELETE_CATEGORY}`: {
                    if (!routeParams?.toolCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.toolsCategoryService.deleteToolCategory(routeParams.toolId);
                }

                // Tool Execution Routes
                case `${CRUDOperationName.POST}-${CRUDToolRoute.VALIDATE_TOOL}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: OB1ToolDto.ValidateToolCodeDto, type: 'body' }
                    );
                    return await this.toolsExecutionService.validateAnyToolCode(validatedBody);
                }
                case `${CRUDOperationName.POST}-${CRUDToolRoute.DEPLOY_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.toolsExecutionService.deployAnyTool(routeParams.toolId);
                }

                case `${CRUDOperationName.POST}-${CRUDToolRoute.TEST_TOOL}`: {
                    if (!routeParams?.toolId) {
                        throw new BadRequestException({
                            message: 'Validation failed: toolId is required',
                            details: { routeParams },
                        });
                    }
                    //this.logger.log(`0. Tool CRUDBodyWithConsultantPayload: ${JSON.stringify(CRUDBodyWithConsultantPayload, null, 2)}`);
                    const toolRequest: OB1ToolDto.ToolRequestDto = {
                        toolId: routeParams.toolId,
                        toolInputVariables: CRUDBodyWithConsultantPayload?.toolInputVariables || {},
                        toolInputENVVariables: CRUDBodyWithConsultantPayload?.toolInputENVVariables || {},
                        requestingServiceId: 'toolsCRUDV1',
                    };
                    this.logger.log(`1. Tool Request: ${JSON.stringify(toolRequest, null, 2)}`);
                    return await this.toolsExecutionService.executeAnyTool(toolRequest);
                }

                default:
                    throw new BadRequestException({
                        message: `Invalid Tool operation: ${operation}-${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {
            this.logger.log(`Error processing tool CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
