import {
    Controller,
    Post,
    Body,
    Get,
    Put,
    Delete,
    Param,
    Query,
    HttpException,
    HttpStatus,
    UseInterceptors,
    ClassSerializerInterceptor,
    ValidationPipe,
    ParseUUIDPipe,
    Logger
} from '@nestjs/common';
import { ActivityRepositoryServiceV1 } from '../services/activity/activityRepositoryV1.service';
import { ActivityRunnerServiceV1 } from '../services/activity/activityRunnerV1.service';
import { OB1AgentActivity, ActivityType, ActivityStatus } from '../entities/ob1-agent-activity.entity';
import { CreateActivityDto, UpdateActivityDto, ExecuteActivityDto } from '../interfaces/activity.interface';
import { ActivityListOptions, PaginatedResponse } from '../interfaces/activity.interface';

@Controller('activities')
@UseInterceptors(ClassSerializerInterceptor)
export class ActivityControllerV1 {
    private readonly logger = new Logger(ActivityControllerV1.name);

    constructor(
        private readonly activityRepository: ActivityRepositoryServiceV1,
        private readonly activityRunner: ActivityRunnerServiceV1
    ) { }

    @Post()
    async createActivity(
        @Body(new ValidationPipe({ transform: true }))
        createActivityDto: CreateActivityDto
    ) {
        try {
            this.logger.log(`Creating new activity: ${createActivityDto.activityName}`);

            const activity = await this.activityRepository.createActivity(createActivityDto);

            this.logger.log(`Activity created successfully: ${activity.activityId}`);
            return activity;
        } catch (error) {
            this.logger.error(`Failed to create activity: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to create activity',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // @Get()
    // async listActivities(
    //     @Query('toolId') toolId?: string,
    //     @Query('status') status?: ActivityStatus,
    //     @Query('type') type?: ActivityType,
    //     @Query('page') page: number = 1,
    //     @Query('limit') limit: number = 10,
    //     @Query('sortBy') sortBy: string = 'createdAt',
    //     @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC'
    // ): Promise<PaginatedResponse<OB1AgentActivity>> {
    //     try {
    //         this.logger.log('Fetching activities list');

    //         const options: ActivityListOptions = {
    //             toolId,
    //             status,
    //             activityType: type,
    //             page,
    //             limit,
    //             sortBy,
    //             sortOrder
    //         };

    //         const [activities, total] = await this.activityRepository.listActivities(options);

    //         return {
    //             data: activities,
    //             meta: {
    //                 page,
    //                 limit,
    //                 total,
    //                 totalPages: Math.ceil(total / limit)
    //             }
    //         };
    //     } catch (error) {
    //         this.logger.error(`Failed to list activities: ${error.message}`);
    //         throw new HttpException(
    //             'Failed to fetch activities',
    //             HttpStatus.INTERNAL_SERVER_ERROR
    //         );
    //     }
    // }

    @Get(':activityId')
    async getActivity(@Param('activityId', ParseUUIDPipe) activityId: string) {
        try {
            this.logger.log(`Fetching activity: ${activityId}`);
            return await this.activityRepository.getActivity(activityId);
        } catch (error) {
            this.logger.error(`Failed to fetch activity ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to fetch activity',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(':activityId')
    async updateActivity(
        @Param('activityId', ParseUUIDPipe) activityId: string,
        @Body(new ValidationPipe({ transform: true })) updateActivityDto: UpdateActivityDto
    ) {
        try {
            this.logger.log(`Updating activity: ${activityId}`);
            return await this.activityRepository.updateActivity(activityId, updateActivityDto);
        } catch (error) {
            this.logger.error(`Failed to update activity ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to update activity',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(':activityId')
    async deleteActivity(@Param('activityId', ParseUUIDPipe) activityId: string) {
        try {
            this.logger.log(`Deleting activity: ${activityId}`);
            await this.activityRepository.deleteActivity(activityId);
            return { message: 'Activity deleted successfully' };
        } catch (error) {
            this.logger.error(`Failed to delete activity ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to delete activity',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':activityId/execute')
    async executeActivity(
        @Param('activityId', ParseUUIDPipe) activityId: string,
        @Body(new ValidationPipe({ transform: true })) executeActivityDto: ExecuteActivityDto
    ) {
        try {
            this.logger.log(`Executing activity: ${activityId}`);

            const result = await this.activityRunner.executeActivity(
                activityId,
                executeActivityDto.input,
                executeActivityDto.options
            );

            return result;
        } catch (error) {
            this.logger.error(`Failed to execute activity ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to execute activity',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':activityId/activityCode')
    async getActivityCode(@Param('activityId', ParseUUIDPipe) activityId: string) {
        try {
            const activity = await this.activityRepository.getActivity(activityId);
            return { activityCode: activity.activityCode };
        } catch (error) {
            this.logger.error(`Failed to fetch activity activityCode ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to fetch activity activityCode',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(':activityId/activityCode')
    async updateActivityCode(
        @Param('activityId', ParseUUIDPipe) activityId: string,
        @Body('activityCode', new ValidationPipe()) activityCode: string
    ) {
        try {
            this.logger.log(`Updating activityCode for activity: ${activityId}`);
            return await this.activityRepository.updateActivity(activityId, { activityCode });
        } catch (error) {
            this.logger.error(`Failed to update activity activityCode ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to update activity activityCode',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':activityId/test')
    async testActivity(
        @Param('activityId', ParseUUIDPipe) activityId: string,
        @Body(new ValidationPipe({ transform: true })) executeActivityDto: ExecuteActivityDto
    ) {
        try {
            this.logger.log(`Testing activity: ${activityId}`);

            // Execute with test flag
            const result = await this.activityRunner.executeActivity(
                activityId,
                executeActivityDto.input,
                {
                    ...executeActivityDto.options,
                    //  isTest: true, 
                }
            );

            return {
                success: true,
                result,
                executionTime: result.executionTime,
                memoryUsage: result.memoryUsage
            };
        } catch (error) {
            this.logger.error(`Failed to test activity ${activityId}: ${error.message}`);
            return {
                success: false,
                error: error.message,
                details: error.details || {}
            };
        }
    }

    @Get(':activityId/metrics')
    async getActivityMetrics(@Param('activityId', ParseUUIDPipe) activityId: string) {
        try {
            const activity = await this.activityRepository.getActivity(activityId);
            return {
                executionCount: activity.activityExecutionCount,
                avgExecutionTime: activity.activityAvgExecutionTime,
                lastExecuted: activity.activityUpdatedAt,
                status: activity.activityStatus
            };
        } catch (error) {
            this.logger.error(`Failed to fetch activity metrics ${activityId}: ${error.message}`);
            throw new HttpException(
                error.message || 'Failed to fetch activity metrics',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}