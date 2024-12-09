// src/tools/interfaces/tools.interface.ts

import { IsString, IsEnum, IsObject, IsOptional, IsArray, IsNumber, IsUUID, Min, Max, ArrayMinSize, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';



export namespace OB1Tool {
    export enum ToolType {
        PYTHON_SCRIPT = 'python_script',
        API_ENDPOINT = 'api_endpoint',
        SYSTEM_COMMAND = 'system_command',
        DATABASE_QUERY = 'database_query',
        CUSTOM_FUNCTION = 'custom_function'
    }

    export enum ToolStatus {
        ACTIVE = 'active',
        DEPLOYED = 'deployed',
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

    export interface CreateTool {

        toolName: string;
        toolDescription: string;
        toolType: ToolType;
        toolStatus?: ToolStatus;
        toolInputSchema: Record<string, any>;
        toolOutputSchema: Record<string, any>;
        toolConfig: Record<string, any>;
        toolCode?: string;
        toolPythonRequirements?: string;
        toolIdentifier?: string;
        toolTags: string[];
        toolCategoryId?: string;
        toolAllowedAgents: string[];
        toolUsageQuota?: UsageQuotaDto;
        toolExamples?: string;
        toolMetadata?: Record<string, any>;
        personId: string;
        consultantOrgShortName: string;
    }

    export interface UpdateTool extends CreateTool {

        toolName: string;
        toolDescription: string;
        toolType: ToolType;
    }

    export class ToolQueryParamsDto {
        toolStatus?: ToolStatus;
        toolCategoryId?: string;
        toolTags?: string[];
        toolType?: ToolType;
        search?: string;
        page?: number;
        limit?: number;
        personId: string;
        consultantOrgShortName: string;
    }

    export class CreateCategory {

        toolCategoryName: string;
        toolCategoryDescription: string;
        personId: string;
        consultantOrgShortName: string;
    }

    export class GetCategory {
        consultantOrgShortName: string;
    }

    export class UpdateCategory {

        toolCategoryName?: string;
        toolCategoryDescription?: string;
        personId: string;
        consultantOrgShortName: string;
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

    export interface PaginatedResponse<T> {
        items: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }

    export interface ToolUpdateResult {
        previousVersion: ToolResponseDto;
        updatedVersion: ToolResponseDto;
        changes: string[];
    }

    export interface ToolRequest {

        toolId: string;
        toolInputVariables?: Record<string, any>;
        requestingServiceId: string;
        toolInputENVVariables?: Record<string, any>;
    }

    export interface ToolResponse {

        toolResult: any;
        toolSuccess: boolean;
        toolExecutionTime: number;
    }

    export interface ToolCallLog {
        toolName: string;
        toolInputArguments: Record<string, any>;
        toolOutput: any;
        toolError?: any
        toolstatusCodeReturned?: number;
        toolExecutionTime: number;
    }

}