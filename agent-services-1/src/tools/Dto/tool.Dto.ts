// src/tools/interfaces/tools.interface.ts

import { IsString, IsNotEmpty, IsEnum, IsObject, IsOptional, IsArray, IsNumber, IsUUID, Min, Max, ArrayMinSize, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1Tool } from '../interfaces/tools.interface';

// export namespace OB1Tool {
// export enum ToolType {
//     PYTHON_SCRIPT = 'python_script',
//     API_ENDPOINT = 'api_endpoint',
//     SYSTEM_COMMAND = 'system_command',
//     DATABASE_QUERY = 'database_query',
//     CUSTOM_FUNCTION = 'custom_function'
// }

// export enum ToolStatus {
//     ACTIVE = 'active',
//     DEPRECATED = 'deprecated',
//     TESTING = 'testing',
//     DISABLED = 'disabled'
// }
// }

export namespace OB1ToolDto {


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

        @IsEnum(OB1Tool.ToolType)
        toolType: OB1Tool.ToolType;

        @IsOptional()
        @IsEnum(OB1Tool.ToolStatus)
        toolStatus?: OB1Tool.ToolStatus;

        @IsObject()
        toolInputSchema: Record<string, any>;

        @IsObject()
        toolOutputSchema: Record<string, any>;

        @IsOptional()
        @IsObject()
        toolENVInputSchema: Record<string, any>;

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

        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class ValidateToolCodeDto {

        @IsString()
        toolName: OB1AgentTools['toolName'];

        @IsString()
        toolCode: OB1AgentTools['toolCode'];

        @IsString()
        toolPythonRequirements: OB1AgentTools['toolPythonRequirements'];  // need to expand this to include other requirements

        @IsEnum(OB1Tool.ToolType)
        toolType: OB1AgentTools['toolType'];
    }

    export class UpdateToolDto {
        @IsOptional()
        @IsString()
        toolName: string;

        @IsOptional()
        @IsString()
        toolDescription: string;

        @IsOptional()
        @IsEnum(OB1Tool.ToolType)
        toolType: OB1Tool.ToolType;

        @IsOptional()
        @IsEnum(OB1Tool.ToolStatus)
        toolStatus?: OB1Tool.ToolStatus;

        @IsOptional()
        @IsObject()
        toolInputSchema: Record<string, any>;

        @IsOptional()
        @IsObject()
        toolOutputSchema: Record<string, any>;

        @IsOptional()
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

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        toolTags: string[];

        @IsOptional()
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

    export class ToolQueryParamsDto {
        @IsOptional()
        @IsEnum(OB1Tool.ToolStatus)
        toolStatus?: OB1Tool.ToolStatus;

        @IsOptional()
        @IsString()
        toolCategoryId?: string;

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        toolTags?: string[];

        @IsOptional()
        @IsEnum(OB1Tool.ToolType)
        toolType?: OB1Tool.ToolType;

        @IsOptional()
        @IsString()
        search?: string;

        @IsOptional()
        @IsNumber()
        page?: number;

        @IsOptional()
        @IsNumber()
        limit?: number;

        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class CreateCategoryDto {
        @IsString()
        toolCategoryName: string;

        @IsString()
        toolCategoryDescription: string;

        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class GetToolIdsByExternalNamesDto {
        @IsArray()
        @IsString({ each: true })
        externalNames: string[];
    }

    export class GetCategoryDto {
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class UpdateCategoryDto {
        @IsOptional()
        @IsString()
        toolCategoryName?: string;

        @IsOptional()
        @IsString()
        toolCategoryDescription?: string;

        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class ToolResponseDto {
        toolId: string;
        toolName: string;
        toolDescription: string;
        toolType: OB1Tool.ToolType;
        toolStatus: OB1Tool.ToolStatus;
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

    export class ToolRequestDto {

        @IsString()
        toolId: string;

        @IsString()
        requestingServiceId: string;

        @IsOptional()
        @IsObject()
        toolInputVariables?: Record<string, any>;

        @IsOptional()
        @IsObject()
        toolENVInputVariables?: Record<string, any>;
    }

    export class ToolResponse {

        @IsObject()
        toolResult: any;

        @IsBoolean()
        toolSuccess: boolean;

        @IsNumber()
        toolExecutionTime: number;
    }

    export class GetToolFieldsDto {
        @IsArray()
        @IsString({ each: true })
        toolIds: string[];

        @IsArray()
        @IsString({ each: true })
        @ArrayMinSize(1)
        fields: string[];
    }

    // export class GetToolFieldsDto {
    //     @IsUUID()
    //     toolId: string;

    //     @IsArray()
    //     @IsString({ each: true })
    //     @ArrayMinSize(1)
    //     fields: string[];
    // }
    // export class ToolPythonRequest {

    //     @IsObject()
    //     tool: OB1AgentTools;

    //     @IsObject()
    //     toolInput: any;


    //     @IsString()
    //     requestingServiceId: string;
    // }

    // export class ToolPythonResponse {

    //     @IsObject()
    //     toolResult: any;

    //     @IsBoolean()
    //     toolSuccess: boolean;

    //     @IsNumber()
    //     toolExecutionTime: number;

    //     @IsOptional()
    //     toolError?: any;

    //     @IsOptional()
    //     toolstatusCodeReturned?: number;

    // }
}