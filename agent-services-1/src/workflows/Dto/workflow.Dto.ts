// /src/workflow/Dto/workflow.Dto.ts

import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsObject,
    IsArray,
    IsUUID,
} from 'class-validator';
import { OB1Workflow } from '../interfaces/workflow.interface';

export namespace OB1WorkflowDto {
    export class CreateWorkflowDto {
        @IsNotEmpty()
        @IsString()
        workflowName: string;

        @IsNotEmpty()
        @IsString()
        workflowDescription: string;

        @IsNotEmpty()
        @IsEnum(OB1Workflow.WorkflowLang)
        workflowLang: OB1Workflow.WorkflowLang;

        @IsNotEmpty()
        @IsString()
        workflowCode: string;

        @IsNotEmpty()
        @IsString()
        workflowMockCode: string;

        @IsNotEmpty()
        @IsObject()
        workflowInputSchema: Record<string, any>;

        @IsNotEmpty()
        @IsObject()
        workflowOutputSchema: Record<string, any>;

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        workflowImports?: string[];

        @IsNotEmpty()
        @IsArray()
        @IsUUID('all', { each: true })
        activitiesUsedByWorkflow: string[]; // Array of activity UUIDs

        // Additional fields such as consultantOrgShortName and personId
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;

        @IsNotEmpty()
        @IsString()
        personId: string;
    }

    export class UpdateWorkflowDto {
        @IsOptional()
        @IsString()
        workflowName?: string;

        @IsOptional()
        @IsEnum(OB1Workflow.WorkflowLang)
        workflowLang?: OB1Workflow.WorkflowLang;

        @IsOptional()
        @IsString()
        workflowCode?: string;

        @IsOptional()
        @IsString()
        workflowMockCode?: string;

        @IsOptional()
        @IsObject()
        workflowInputSchema?: Record<string, any>;

        @IsOptional()
        @IsObject()
        workflowOutputSchema?: Record<string, any>;

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        workflowImports?: string[];

        // Additional fields such as consultantOrgShortName and personId
        @IsOptional()
        @IsString()
        consultantOrgShortName?: string;

        @IsOptional()
        @IsString()
        personId?: string;
    }

    export class WorkflowQueryParamsDto {
        @IsOptional()
        @IsString()
        search?: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;

        @IsOptional()
        @IsString()
        personId?: string;
    }

    export class TestWorkflowDto {
        @IsNotEmpty()
        @IsObject()
        workflowInput: Record<string, any>;

        // Additional fields such as consultantOrgShortName and personId
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;

        @IsNotEmpty()
        @IsString()
        personId: string;
    }

    export class CreateCategoryDto {
        @IsNotEmpty()
        @IsString()
        workflowCategoryName: string;

        @IsOptional()
        @IsString()
        workflowCategoryDescription?: string;

        // Additional fields such as consultantOrgShortName and personId
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;

        @IsNotEmpty()
        @IsString()
        personId: string;
    }
    export class GetCategoryDto {
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }
    export class UpdateCategoryDto {
        @IsOptional()
        @IsString()
        workflowCategoryName?: string;

        @IsOptional()
        @IsString()
        workflowCategoryDescription?: string;

        // Additional fields such as consultantOrgShortName and personId
        @IsOptional()
        @IsString()
        consultantOrgShortName?: string;

        @IsOptional()
        @IsString()
        personId?: string;
    }
}
