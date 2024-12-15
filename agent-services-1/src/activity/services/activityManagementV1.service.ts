// /src/activitys/services/activityManagementV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OB1AgentActivities } from '../entities/ob1-agent-activities.entity';
import { OB1AgentActivityCategory } from '../entities/ob1-agent-activityCategory.entity';

import { OB1Activity } from '../interfaces/activity.interface';

import { ActivityTestingV1Service } from './activityTestingV1.service';
import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';

@Injectable()
export class ActivityManagementV1Service {
    private readonly logger = new Logger(ActivityManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        @InjectRepository(OB1AgentActivityCategory) private readonly activityCategoryRepository: Repository<OB1AgentActivityCategory>,
        private readonly activityTestingV1Service: ActivityTestingV1Service,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }

    // Create Activity
    async createActivity(activity: OB1Activity.CreateActivity): Promise<OB1Activity.ServiceResponse<OB1Activity.ActivityResponse>> {
        try {
            const category = activity.activityCategoryId
                ? await this.activityCategoryRepository.findOne({
                    where: {
                        activityCategoryId: activity.activityCategoryId,
                        activityCategoryCreatedByConsultantOrgShortName: activity.consultantOrgShortName
                    }
                })
                : null;

            if (activity.activityCategoryId && !category) {
                throw new BadRequestException({
                    message: 'Category not found',
                    code: 'CATEGORY_NOT_FOUND'
                });
            }

            // Validate activity using ActivityTestingV1Service
            await this.activityTestingV1Service.validateAnyActivity(activity);

            // CODE CLEANUP - Series of code cleanup steps
            const codeCleanup1 = this.tsValidationOb1Service.updateConfigInputToOptionalIfUnused(activity.activityCode);
            const codeCleanup2 = this.tsValidationOb1Service.removeExportDefaultModifiers(codeCleanup1);

            if (codeCleanup2 !== activity.activityCode) {
                activity.activityCode = codeCleanup2;
            }

            const newActivity = this.activityRepository.create({
                ...activity,
                activityCategory: category,
                activityCreatedByConsultantOrgShortName: activity.consultantOrgShortName,
                activityCreatedByPersonId: activity.personId
            });

            const savedActivity = await this.activityRepository.save(newActivity);
            return {
                success: true,
                data: this.mapToActivityResponse(savedActivity),
            };
        } catch (error) {
            this.logger.error(`Failed to create activity: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create activity',
                code: 'ACTIVITY_CREATION_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Fetch Activity
    async getActivity(id: string): Promise<OB1Activity.ServiceResponse<OB1Activity.ActivityResponseDto>> {
        try {
            const activity = await this.activityRepository.findOne({ where: { activityId: id } });

            if (!activity) {
                throw new BadRequestException({
                    message: `Activity with ID ${id} not found`,
                    code: 'ACTIVITY_NOT_FOUND'
                });
            }

            return {
                success: true,
                data: activity,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch activity: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch activity',
                code: 'ACTIVITY_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Fetch Activities (Paginated)
    async getActivities(
        params: OB1Activity.ActivityQueryParams,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.PaginatedResponse<OB1Activity.ActivityResponse>>> {
        try {
            const { activityCategoryId, search, consultantOrgShortName, page = 1, limit = 10 } = params;

            const queryBuilder = this.activityRepository
                .createQueryBuilder('activity')
                .leftJoinAndSelect('activity.activityCategory', 'activityCategory')
                .where('activity.activityCreatedByConsultantOrgShortName = :consultantOrgShortName', { consultantOrgShortName });

            if (activityCategoryId) {
                queryBuilder.andWhere('activityCategory.activityCategoryId = :activityCategoryId', { activityCategoryId });
            }

            if (search) {
                queryBuilder.andWhere(
                    '(activity.activityName ILIKE :search OR activity.activityDescription ILIKE :search)',
                    { search: `%${search}%` },
                );
            }

            const total = await queryBuilder.getCount();
            const activities = await queryBuilder
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return {
                success: true,
                data: {
                    items: activities.map(this.mapToActivityResponse),
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to fetch activities: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch activities',
                code: 'ACTIVITIES_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Update Activity , however this does not update rather creates a new version of the activity
    async updateActivity(
        id: string,
        updates: OB1Activity.UpdateActivity,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.ActivityUpdateResult>> {
        try {
            const activity = await this.activityRepository.findOne({ where: { activityId: id } });

            if (!activity) {
                throw new BadRequestException({
                    message: `Activity with ID ${id} not found`,
                    code: 'ACTIVITY_NOT_FOUND'
                });
            }

            // Fetch the previous version
            const previousVersion = this.mapToActivityResponse(activity);

            if (updates.activityCode) {
                const updatedActivityCode = this.tsValidationOb1Service.updateConfigInputToOptionalIfUnused(updates.activityCode);
                if (updatedActivityCode !== updates.activityCode) {
                    updates.activityCode = updatedActivityCode;
                }
            }
            // Prepare the updated fields for the new version
            const newActivityData = {
                ...activity,
                ...updates, // Apply updates
                activityId: undefined, // Ensure new record is created
            };



            // Call the createActivity method
            const response = await this.createActivity(newActivityData);

            if (!response.success) {
                throw new BadRequestException({
                    message: 'Failed to create new activity version',
                    code: 'ACTIVITY_UPDATE_FAILED',
                    errorSuperDetails: response.error
                });
            }

            return {
                success: true,
                data: {
                    previousVersion,
                    updatedVersion: response.data,
                    changes: Object.keys(updates),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to update activity: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update activity',
                code: 'ACTIVITY_UPDATE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Delete Activity
    async deleteActivity(id: string): Promise<OB1Activity.ServiceResponse<void>> {
        try {
            const activity = await this.activityRepository.findOne({ where: { activityId: id } });

            if (!activity) {
                throw new BadRequestException({
                    message: `Activity with ID ${id} not found`,
                    code: 'ACTIVITY_NOT_FOUND'
                });
            }

            await this.activityRepository.remove(activity);
            return {
                success: true,
            };
        } catch (error) {
            this.logger.error(`Failed to delete activity: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete activity',
                code: 'ACTIVITY_DELETE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }


    // Map to Activity Response
    private mapToActivityResponse(activity: OB1AgentActivities): OB1Activity.ActivityResponse {
        return {
            activityId: activity.activityId,
            activityName: activity.activityName,
            activityExternalName: activity.activityExternalName,
            activityDescription: activity.activityDescription,
            activityCategory: activity.activityCategory
                ? {
                    activityCategoryId: activity.activityCategory.activityCategoryId,
                    activityCategoryName: activity.activityCategory.activityCategoryName
                }
                : undefined,
            activityCreatedAt: activity.activityCreatedAt,
            activityUpdatedAt: activity.activityUpdatedAt,
        };
    }
}
