import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { DynamicObjectValidator } from '../Dto/DynamicObject.validator'


export namespace OB1Prompt {

    export enum DefaultPromptConfig {
        DEFAULT_MAX_LLM_CALLS = 5,
        DEFAULT_MAX_TOOL_CALLS = 5,
        DEFAULT_MAX_TOOL_EXECUTION_TIME = 30000, //30secs
    }

    export enum PromptStatus {
        DRAFT = 'DRAFT',
        ACTIVE = 'ACTIVE',
        ARCHIVED = 'ARCHIVED'
    }

    // export enum PromptCategory {
    //     GENERAL = 'GENERAL',
    //     ANALYSIS = 'ANALYSIS',
    //     CODING = 'CODING',
    //     WRITING = 'WRITING',
    //     CUSTOM = 'CUSTOM',
    //     SALESFORCE = 'SALESFORCE',
    // }


    export interface ExecutePromptWithToolsBase {
        promptId: string;
        systemPromptVariables?: Record<string, any>;

        requestId: string;
        requestMetadata: Record<string, any>;

        llmConfig?: Partial<OB1LLM.LLMConfig>;
        promptConfig?: {
            maxToolCalls?: number;
            maxLLMCalls?: number;
            toolTimeout?: number;
            maxTotalExecutionTime?: number;
        };
    }

    export interface ExecutePromptWithUserPrompt extends ExecutePromptWithToolsBase {
        userPrompt: string;
    }

    export interface ExecutePromptWithoutUserPrompt extends ExecutePromptWithToolsBase {
        userPromptVariables: Record<string, any>;
    }

    export class VariableDefinitionDto {
        @IsString()
        type: string;

        @IsString()
        description: string;

        @IsBoolean()
        required: boolean;

        @IsOptional()
        defaultValue?: any;
    }

    export class LLMConfigDto {
        //@IsOptional()
        @IsString()
        provider: OB1LLM.LLMProvider;

        //@IsOptional()
        @IsString()
        model: OB1LLM.AnthropicModels | OB1LLM.OpenAIModels;

        @IsOptional()
        temperature?: number;

        @IsOptional()
        maxTokens?: number;
    }


    export class CreatePrompt {
        @IsString()
        promptName: string;

        @IsString()
        promptDescription: string;

        @IsString()
        systemPrompt: string;

        @IsOptional()
        @IsString()
        userPrompt: string;

        @IsUUID()
        promptCategoryId: string;

        @IsOptional()
        @IsEnum(PromptStatus)
        promptStatus?: PromptStatus = PromptStatus.DRAFT;


        @IsObject()
        @ValidateNested()
        @Type(() => LLMConfigDto)
        promptDefaultConfig: LLMConfigDto;

        // @IsOptional()
        // @IsArray()
        // @IsString({ each: true })
        // promptAvailableTools?: string[];

        @IsOptional()
        @IsArray()
        promptAvailableTools?: string[];  //only the toolId's in Array

        @IsOptional()
        @IsObject()
        @DynamicObjectValidator({
            message: 'systemPromptVariables must be an object with valid VariableDefinitionDto values.',
        })
        systemPromptVariables?: {
            [key: string]: VariableDefinitionDto;
        };

        @IsOptional()
        @IsObject()
        @DynamicObjectValidator({
            message: 'userPromptVariables must be an object with valid VariableDefinitionDto values.',
        })
        userPromptVariables: {
            [key: string]: VariableDefinitionDto;
        };

        //response_format
        @IsOptional()
        promptResponseFormat?: OB1LLM.ResponseFormatJSONSchema;
        //e.g
        // response_format: {
        //     "type": "json_schema",
        //         "json_schema": {
        //         "name": "standard_response_format",
        //             "description": "standard format so output can be formatted consistently",
        //                 "schema": {
        //             "content": {
        //                 "type": "string"
        //             }
        //         },
        //         strict: true
        //     }
        // },

        consultantOrgShortName: string;
        personId: string;

    }


    export class UpdatePromptDto extends CreatePrompt {
        @IsOptional()
        @IsEnum(PromptStatus)
        promptStatus?: PromptStatus;
    }

    // export class ExecutePromptwithUserPromptDto {

    //     @IsString()
    //     promptId: string;




    //     @IsOptional()
    //     @IsObject()
    //     systemPromptVariables?: {
    //         [key: string]: any;
    //     };

    //     @IsString()
    //     requestId: string;

    //     // //tracing
    //     // @Type(() => OB1LLM.promptTracing)
    //     // tracing: OB1LLM.promptTracing;
    //     // //metadata dictionary 

    //     @IsObject()
    //     requestMetadata: {
    //         [key: string]: any;
    //     };

    //     @IsOptional()
    //     @IsObject()
    //     llmConfig?: LLMConfigDto;
    // }

    // export class ExecutePromptWithUserPromptNoToolExec extends ExecutePromptwithUserPromptDto {
    //     @IsString()
    //     userPrompt: string;

    // }

    // export class ExecutePromptwithoutUserPromptDto {
    //     @IsOptional()
    //     @IsObject()
    //     userPromptVariables: {
    //         [key: string]: any;
    //     };

    //     @IsOptional()
    //     @IsObject()
    //     systemPromptVariables?: {
    //         [key: string]: any;
    //     };

    //     //tracing
    //     @Type(() => OB1LLM.promptTracing)
    //     tracing: OB1LLM.promptTracing;

    //     @IsObject()
    //     requestMetadata: {
    //         [key: string]: any;
    //     };

    //     @IsOptional()
    //     @IsObject()
    //     llmConfig?: LLMConfigDto;
    // }

    // export class ExecutePromptWithoutUserPromptNoToolExec extends ExecutePromptwithoutUserPromptDto {
    //     @IsString()
    //     promptId: string;


    // }

    export class ListPromptsQueryDto {
        @IsOptional()
        @IsEnum(PromptStatus)
        status?: PromptStatus;

        @IsOptional()
        @IsString()
        category?: string;

        @IsOptional()
        @IsString()
        search?: string;

        consultantOrgShortName: string;
        personId: string;
    }

    export class ExecutionLogsQueryDto {
        @IsOptional()
        startDate?: Date;

        @IsOptional()
        endDate?: Date;

        @IsOptional()
        successful?: boolean;

        @IsOptional()
        @Type(() => Number)
        limit?: number = 10;

        @IsOptional()
        @Type(() => Number)
        offset?: number = 0;
    }
}