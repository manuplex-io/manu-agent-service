// /src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/activityCRUDV1.service.ts
import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ActivityManagementV1Service } from 'src/activity/services/activityManagementV1.service';
import { ActivityTestingV1Service } from 'src/activity/services/activityTestingV1.service';
import { ActivityCategoryManagementV1Service } from 'src/activity/services/activityCategoryManagementV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDActivityRoute,
} from '../../../interfaces/CRUD.interfaces';
import {
    OB1ActivityDto,
    OB1ActivityDto as ActivityDto,
} from 'src/activity/Dto/activity.Dto';

import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class ActivityCRUDV1 {
    private readonly logger = new Logger(ActivityCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly activityManagementService: ActivityManagementV1Service,
        private readonly activityTestingService: ActivityTestingV1Service,
        private readonly activityCategoryService: ActivityCategoryManagementV1Service,
    ) {
        this.validationPipe = new ValidationPipe({
            transform: true,
            whitelist: true,
            //forbidNonWhitelisted: true, // Raise error if extra properties not in the DTO
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

    async CRUDActivityRoutes(functionInput: CRUDFunctionInputExtended) {
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

            this.logger.log(`CRUDActivityRoutes: functionInput:\n${JSON.stringify(functionInput, null, 2)}`);
            this.logger.log(`CRUDActivityRoutes: CRUDBodyWithConsultantPayload:\n${JSON.stringify(CRUDBodyWithConsultantPayload, null, 2)}`);


            switch (`${operation}-${route}`) {
                // Activities Routes
                case `${CRUDOperationName.GET}-${CRUDActivityRoute.LIST_ACTIVITIES}`: {
                    const updatedQueryParams = {
                        ...queryParams, consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                        personId: consultantPayload?.personId,
                    };
                    const validatedQuery = await this.validationPipe.transform(
                        updatedQueryParams,
                        { metatype: ActivityDto.ActivityQueryParamsDto, type: 'query' }
                    );
                    return await this.activityManagementService.getActivities(validatedQuery);
                }

                case `${CRUDOperationName.GET}-${CRUDActivityRoute.GET_ACTIVITY}`: {
                    if (!routeParams?.activityId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.activityManagementService.getActivity(routeParams.activityId);
                }

                case `${CRUDOperationName.POST}-${CRUDActivityRoute.CREATE_ACTIVITY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: ActivityDto.CreateActivityDto, type: 'body' }
                    );
                    return await this.activityManagementService.createActivity(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDActivityRoute.UPDATE_ACTIVITY}`: {
                    if (!routeParams?.activityId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: ActivityDto.CreateActivityDto, type: 'body' }
                    );
                    return await this.activityManagementService.updateActivity(routeParams.activityId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDActivityRoute.DELETE_ACTIVITY}`: {
                    if (!routeParams?.activityId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.activityManagementService.deleteActivity(routeParams.activityId);
                }

                // Category Routes
                case `${CRUDOperationName.GET}-${CRUDActivityRoute.LIST_CATEGORIES}`: {
                    return await this.activityCategoryService.getCategories();
                }

                case `${CRUDOperationName.POST}-${CRUDActivityRoute.CREATE_CATEGORY}`: {
                    //this.logger.log(`Pre validation CRUDActivityRoutes: CRUDBodyWithConsultantPayload:\n${JSON.stringify(CRUDBodyWithConsultantPayload, null, 2)}`);
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: ActivityDto.CreateCategoryDto, type: 'body' }
                    );
                    //this.logger.log(`Post validation CRUDActivityRoutes: validatedBody:\n${JSON.stringify(validatedBody, null, 2)}`);
                    return await this.activityCategoryService.createCategory(validatedBody);
                }

                case `${CRUDOperationName.PUT}-${CRUDActivityRoute.UPDATE_CATEGORY}`: {
                    if (!routeParams?.activityCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: ActivityDto.UpdateCategoryDto, type: 'body' }
                    );
                    return await this.activityCategoryService.updateCategory(routeParams.activityCategoryId, validatedBody);
                }

                case `${CRUDOperationName.DELETE}-${CRUDActivityRoute.DELETE_CATEGORY}`: {
                    if (!routeParams?.activityCategoryId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityCategoryId is required',
                            details: { routeParams },
                        });
                    }
                    return await this.activityCategoryService.deleteCategory(routeParams.activityCategoryId);
                }

                // Activity Testing Routes
                case `${CRUDOperationName.POST}-${CRUDActivityRoute.TEST_ACTIVITY}`: {
                    if (!routeParams?.activityId) {
                        throw new BadRequestException({
                            message: 'Validation failed: activityId is required',
                            details: { routeParams },
                        });
                    }
                    const activityRequest = CRUDBodyWithConsultantPayload;
                    return await this.activityTestingService.testAnyActivityWithActivityId(routeParams.activityId, activityRequest);
                }

                // Validate Activity Only i.e without Saving
                case `${CRUDOperationName.POST}-${CRUDActivityRoute.VALIDATE_ACTIVITY_ONLY}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: ActivityDto.CreateActivityDto, type: 'body' }
                    );
                    return await this.activityTestingService.validateAnyActivity(validatedBody);
                }

                default:
                    throw new BadRequestException({
                        message: `Invalid Activity operation: ${operation} - ${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {

            this.logger.log(`Error processing activity CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
