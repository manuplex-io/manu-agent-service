// src/workflows/interfaces/workflow.interface.ts
import { IsString, IsEnum, IsObject, IsOptional, IsUUID, IsArray, ValidateNested, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowStatus } from '../entities/ob1-agent-workflow.entity';

// Base DTO for common workflow properties
export class WorkflowBaseDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    workflowName: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    workflowDescription: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    workflowCode: string;

    @IsObject()
    @IsOptional()
    workflowInputSchema?: Record<string, any>;

    @IsObject()
    @IsOptional()
    workflowOutputSchema?: Record<string, any>;

    @IsObject()
    @IsOptional()
    workflowMetadata?: Record<string, any>;
}

// DTO for activity references within workflows
export class ActivityReferenceDto {
    @IsUUID()
    activityId: string;
}

// DTO for creating new workflows
export class CreateWorkflowDto extends WorkflowBaseDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActivityReferenceDto)
    @IsOptional()
    workflowActivities?: ActivityReferenceDto[];
}

// DTO for updating existing workflows
export class UpdateWorkflowDto extends WorkflowBaseDto {
    @IsEnum(WorkflowStatus)
    @IsOptional()
    workflowStatus?: WorkflowStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActivityReferenceDto)
    @IsOptional()
    workflowActivities?: ActivityReferenceDto[];
}

// DTO for filtering workflow lists
export class ListWorkflowsDto {
    @IsEnum(WorkflowStatus)
    @IsOptional()
    workflowStatus?: WorkflowStatus;

    @IsUUID()
    @IsOptional()
    activityId?: string;
}

// DTO for workflow execution metrics update
export class UpdateWorkflowMetricsDto {
    @IsUUID()
    workflowId: string;

    @IsNotEmpty()
    executionTime: number;
}

// Response DTO for workflow operations
export class WorkflowResponseDto {
    @IsUUID()
    workflowId: string;

    @IsString()
    workflowName: string;

    @IsString()
    workflowDescription: string;

    @IsEnum(WorkflowStatus)
    workflowStatus: WorkflowStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActivityReferenceDto)
    workflowActivities: ActivityReferenceDto[];

    @IsObject()
    workflowInputSchema: Record<string, any>;

    @IsObject()
    workflowOutputSchema: Record<string, any>;

    workflowExecutionCount: number;

    workflowAvgExecutionTime: number;

    workflowCreatedAt: Date;

    workflowUpdatedAt: Date;

    @IsObject()
    workflowMetadata: Record<string, any>;
}
