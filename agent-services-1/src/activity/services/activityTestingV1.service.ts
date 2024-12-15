import { Injectable, BadRequestException } from '@nestjs/common';
import { ActivityTypeScriptV1Service } from './activityLang/activityTypeScriptV1.service';
import { OB1Activity } from '../interfaces/activity.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentActivities } from '../entities/ob1-agent-activities.entity';

@Injectable()
export class ActivityTestingV1Service {
    constructor(
        private readonly activityTypeScriptV1Service: ActivityTypeScriptV1Service,
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
    ) { }

    /**
     * Validate any activity based on its activityLang.
     * @param activity the full activity object
     */
    async validateAnyActivity(activity: OB1Activity.CreateActivity): Promise<void> {
        switch (activity.activityLang) {
            case OB1Activity.ActivityLang.TYPESCRIPT:
                await this.activityTypeScriptV1Service.validateActivity({
                    activityCode: activity.activityCode,
                    activityInputSchema: activity.activityInputSchema,
                    activityENVInputSchema: activity.activityENVInputSchema ? activity.activityENVInputSchema : undefined,
                    activityOutputSchema: activity.activityOutputSchema,
                    activityImports: activity.activityImports,
                });
                break;
            default:
                throw new BadRequestException(`Unsupported activityLang: ${activity.activityLang}`);
        }
    }


    /**
     * Test any activity based on its activityLang.
     * @param activity the full activity object
     * @param activityRequest the request object to test the activity with
     */
    async testAnyActivity(
        activity: OB1Activity.CreateActivity,
        activityInputVariables: Record<string, any>,
        activityENVInputVariables: Record<string, any>
    ): Promise<any> {
        switch (activity.activityLang) {
            case OB1Activity.ActivityLang.TYPESCRIPT:
                return this.activityTypeScriptV1Service.testActivity(
                    {
                        activityCode: activity.activityCode,
                        activityInputSchema: activity.activityInputSchema,
                        activityENVInputSchema: activity.activityENVInputSchema,
                        activityOutputSchema: activity.activityOutputSchema,
                        activityImports: activity.activityImports,
                    },
                    activityInputVariables,
                    activityENVInputVariables
                );
            default:
                throw new BadRequestException(`Unsupported activityLang: ${activity.activityLang}`);
        }
    }

    /**
     * Test any activity based on its activityLang.
     * @param activityId the activityId of the activity to test
     * @param activityRequest the request object to test the activity with
     */
    async testAnyActivityWithActivityId(
        activityId: string,
        activityInputVariables: Record<string, any>,
        activityENVInputVariables: Record<string, any>
    ): Promise<any> {
        let activity: OB1AgentActivities;

        try {
            activity = await this.activityRepository.findOne({ where: { activityId: activityId } });

            if (!activity) {
                return {
                    success: false,
                    error: {
                        code: 'ACTIVITY_NOT_FOUND',
                        message: `Activity with ID ${activityId} not found`,
                    },
                };
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'ACTIVITY_FETCH_FAILED EVEN BEFORE TESTING',
                    message: 'Failed to fetch activity even before testing',
                    details: { error: error.message },
                },
            };
        }





        switch (activity.activityLang) {
            case OB1Activity.ActivityLang.TYPESCRIPT:
                return this.activityTypeScriptV1Service.testActivity(
                    {
                        activityCode: activity.activityCode,
                        activityInputSchema: activity.activityInputSchema,
                        activityENVInputSchema: activity.activityENVInputSchema,
                        activityOutputSchema: activity.activityOutputSchema,
                        activityImports: activity.activityImports,
                    },
                    activityInputVariables,
                    activityENVInputVariables
                );
            default:
                throw new BadRequestException(`Unsupported activityLang: ${activity.activityLang}`);
        }
    }

}
