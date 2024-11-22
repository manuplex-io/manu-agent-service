//src/workflows/interfaces/activity.interface.ts
import { IsString, IsEnum, IsObject, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType, ActivityStatus } from '../entities/ob1-agent-activity.entity';


export class CreateActivityDto {
    @IsString()
    activityName: string;

    @IsString()
    activityDescription: string;

    @IsEnum(ActivityType)
    activityType: ActivityType;

    @IsEnum(ActivityStatus)
    @IsOptional()
    activityStatus?: ActivityStatus;

    @IsString()
    @IsOptional()
    activityCode?: string;

    @IsObject()
    @IsOptional()
    activityInputSchema?: Record<string, any>;

    @IsObject()
    @IsOptional()
    activityOutputSchema?: Record<string, any>;

    @IsObject()
    @IsOptional()
    activityConfig?: Record<string, any>;

    @IsObject()
    @IsOptional()
    activityRetryPolicy?: {
        initialInterval: number;
        backoffCoefficient: number;
        maximumAttempts: number;
        maximumInterval: number;
    };

    @IsUUID()
    @IsOptional()
    toolId?: string;
}

export class UpdateActivityDto extends CreateActivityDto {
    @IsOptional()
    activityName: string;

    @IsOptional()
    activityDescription: string;

    @IsOptional()
    activityType: ActivityType;
}

export class ExecuteActivityDto {
    @IsObject()
    input: Record<string, any>;

    @IsObject()
    @IsOptional()
    options?: {
        timeout?: number;
        memoryLimit?: number;
    };
}



export interface ActivityListOptions {
    toolId?: string;
    status?: ActivityStatus;
    activityType?: ActivityType;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ActivityExecutionOptions {
    timeout?: number;
    memoryLimit?: number;
    isTest?: boolean;
}

export interface ActivityExecutionResult {
    data: any;
    executionTime?: number;
    memoryUsage?: number;
}