// src/tools/interfaces/tools.interface.ts

import { IsString, IsEnum, IsObject, IsOptional, IsArray, IsNumber, IsUUID, Min, Max, ArrayMinSize, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';

export enum ToolType {
    PYTHON_SCRIPT = 'python_script',
    API_ENDPOINT = 'api_endpoint',
    SYSTEM_COMMAND = 'system_command',
    DATABASE_QUERY = 'database_query',
    CUSTOM_FUNCTION = 'custom_function'
}

export enum ToolStatus {
    ACTIVE = 'active',
    DEPRECATED = 'deprecated',
    TESTING = 'testing',
    DISABLED = 'disabled'
}

export class UsageQuotaDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    maxCallsPerMinute?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxCallsPerHour?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxCallsPerDay?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    cooldownPeriod?: number;
}

export class CreateToolDto {
    @IsString()
    toolName: string;

    @IsString()
    toolDescription: string;

    @IsEnum(ToolType)
    toolType: ToolType;

    @IsOptional()
    @IsEnum(ToolStatus)
    toolStatus?: ToolStatus;

    @IsObject()
    toolInputSchema: Record<string, any>;

    @IsObject()
    toolOutputSchema: Record<string, any>;

    @IsObject()
    toolConfig: Record<string, any>;

    @IsOptional()
    @IsString()
    toolCode?: string;

    @IsOptional()
    @IsString()
    toolPythonRequirements?: string;

    @IsOptional()
    @IsString()
    toolIdentifier?: string;

    @IsArray()
    @IsString({ each: true })
    toolTags: string[];

    @IsOptional()
    @IsUUID()
    toolCategoryId?: string;

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(0)
    toolAllowedAgents: string[];

    @IsOptional()
    @ValidateNested()
    @Type(() => UsageQuotaDto)
    toolUsageQuota?: UsageQuotaDto;

    @IsOptional()
    @IsString()
    toolExamples?: string;

    @IsOptional()
    @IsObject()
    toolMetadata?: Record<string, any>;
}

export class UpdateToolDto extends CreateToolDto {
    @IsOptional()
    @IsString()
    toolName: string;

    @IsOptional()
    @IsString()
    toolDescription: string;

    @IsOptional()
    @IsEnum(ToolType)
    toolType: ToolType;
}

export class CreateCategoryDto {
    @IsString()
    toolCategoryName: string;

    @IsString()
    toolCategoryDescription: string;
}

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    toolCategoryName?: string;

    @IsOptional()
    @IsString()
    toolCategoryDescription?: string;
}

export class ToolResponseDto {
    toolId: string;
    toolName: string;
    toolDescription: string;
    toolType: ToolType;
    toolStatus: ToolStatus;
    toolCategory?: {
        toolCategoryId: string;
        toolCategoryName: string;
    };
    toolCreatedAt: Date;
    toolUpdatedAt: Date;
}

export interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: ServiceError;
}

export interface ServiceError {
    code: string;
    message: string;
    details?: Record<string, any>;
}

export interface ToolQueryParams {
    toolStatus?: ToolStatus;
    toolCategoryId?: string;
    toolTags?: string[];
    toolType?: ToolType;
    search?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Event interfaces for Kafka messages
export interface ToolEvent {
    toolEventType: ToolEventType;
    toolId?: string;
    toolCategoryId?: string;
    payload: CreateToolDto | UpdateToolDto | CreateCategoryDto | UpdateCategoryDto;
    userId: string;
    timestamp: Date;
}

export enum ToolEventType {
    TOOL_CREATED = 'tool.created',
    TOOL_UPDATED = 'tool.updated',
    TOOL_DELETED = 'tool.deleted',
    CATEGORY_CREATED = 'category.created',
    CATEGORY_UPDATED = 'category.updated',
    CATEGORY_DELETED = 'category.deleted'
}

export interface ToolUpdateResult {
    previousVersion: ToolResponseDto;
    updatedVersion: ToolResponseDto;
    changes: string[];
}

export class ToolRequest {

    @IsString()
    toolId: string;

    @IsObject()
    toolInput: any;

    @IsString()
    requestingServiceId: string;
}

export class ToolResponse {

    @IsObject()
    toolresult: any;

    @IsBoolean()
    toolSuccess: boolean;

    @IsNumber()
    toolExecutionTime: number;
}

export class ToolPythonRequest {

    @IsObject()
    tool: OB1AgentTools;

    @IsObject()
    toolInput: any;


    @IsString()
    requestingServiceId: string;
}

export class ToolPythonResponse {

    @IsObject()
    toolresult: any;

    @IsBoolean()
    toolSuccess: boolean;

    @IsNumber()
    toolExecutionTime: number;

    @IsOptional()
    toolError?: any;

}