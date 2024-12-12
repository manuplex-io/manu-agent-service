// /src/activitys/services/activityManagementV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OB1AgentActivities } from '../entities/ob1-agent-activities.entity';
import { OB1AgentActivityCategory } from '../entities/ob1-agent-activityCategory.entity';

import { OB1Activity } from '../interfaces/activity.interface';

import { ActivityTestingV1Service } from './activityTestingV1.service';

@Injectable()
export class ActivityManagementV1Service {
    private readonly logger = new Logger(ActivityManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        @InjectRepository(OB1AgentActivityCategory) private readonly activityCategoryRepository: Repository<OB1AgentActivityCategory>,
        private readonly activityTestingV1Service: ActivityTestingV1Service,
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
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: 'Category not found',
                    },
                };
            }

            // Validate activity using ActivityTestingV1Service
            await this.activityTestingV1Service.validateAnyActivity(activity);

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
            this.logger.log(`Failed to create activity:\n${JSON.stringify(error, null, 2)}`);
            throw new BadRequestException({
                message: 'Failed to create activity',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Fetch Activity
    async getActivity(id: string): Promise<OB1Activity.ServiceResponse<OB1Activity.ActivityResponse>> {
        try {
            const activity = await this.activityRepository.findOne({ where: { activityId: id } });

            if (!activity) {
                throw new NotFoundException(`Activity with ID ${id} not found`);
            }

            return {
                success: true,
                data: this.mapToActivityResponse(activity),
            };
        } catch (error) {
            throw new BadRequestException({
                message: 'Failed to fetch activity',
                errorSuperDetails: { error },
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
            throw new BadRequestException({
                message: 'Failed to fetch activities',
                errorSuperDetails: { error },
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
                throw new NotFoundException(`Activity with ID ${id} not found`);
            }

            // Fetch the previous version
            const previousVersion = this.mapToActivityResponse(activity);

            // Prepare the updated fields for the new version
            const newActivityData = {
                ...activity,
                ...updates, // Apply updates
                activityId: undefined, // Ensure new record is created
            };

            // Call the createActivity method
            const response = await this.createActivity(newActivityData);

            if (!response.success) {
                return {
                    success: false,
                    error: response.error,
                };
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
            throw new BadRequestException({
                message: 'Failed to update activity',
                errorSuperDetails: { error },
            });
        }
    }

    // Delete Activity
    async deleteActivity(id: string): Promise<OB1Activity.ServiceResponse<void>> {
        try {
            const activity = await this.activityRepository.findOne({ where: { activityId: id } });

            if (!activity) {
                throw new NotFoundException(`Activity with ID ${id} not found`);
            }

            await this.activityRepository.remove(activity);
            return {
                success: true,
            };
        } catch (error) {
            throw new BadRequestException({
                message: 'Failed to delete activity',
                errorSuperDetails: { error },
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
            activityCode: activity.activityCode,
            activityMockCode: activity.activityMockCode,
            activityInputSchema: activity.activityInputSchema,
            activityOutputSchema: activity.activityOutputSchema,
            activityCategory: activity.activityCategory
                ? {
                    activityCategoryId: activity.activityCategory.activityCategoryId,
                    activityCategoryName: activity.activityCategory.activityCategoryName,
                    activityCreatedByConsultantOrgShortName: activity.activityCategory.activityCategoryCreatedByConsultantOrgShortName
                }
                : undefined,
            activityCreatedAt: activity.activityCreatedAt,
            activityUpdatedAt: activity.activityUpdatedAt,
            activityCreatedByPersonId: activity.activityCreatedByPersonId,
            activityCreatedByConsultantOrgShortName: activity.activityCreatedByConsultantOrgShortName,
        };
    }
}
