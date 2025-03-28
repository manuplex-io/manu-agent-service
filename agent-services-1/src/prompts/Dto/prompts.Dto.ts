// /scr/prompt/Dto/prompt.Dto.ts

import { IsNotEmpty, IsString, IsOptional, IsUUID, IsObject, IsArray, IsEnum, ValidateNested, IsBoolean, IsNumber, } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { OB1Prompt } from '../interfaces/prompt.interface';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { DynamicObjectValidator } from './DynamicObject.validator';


export namespace OB1PromptDto {

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


    export class CreatePromptDto {
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
        @IsEnum(OB1Prompt.PromptStatus)
        promptStatus?: OB1Prompt.PromptStatus = OB1Prompt.PromptStatus.DRAFT;


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
        @IsArray()
        promptAvailableActivities?: string[];  //only the activityId's in Array

        @IsOptional()
        @IsArray()
        promptAvailableWorkflows?: string[];  //only the workflowId's in Array

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
        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;

        @IsBoolean()
        validationRequired: boolean;

        @IsBoolean()
        validationGate: boolean;
    }


    export class UpdatePromptDto {
        @IsOptional()
        @IsString()
        promptName: string;

        @IsOptional()
        @IsString()
        promptDescription: string;

        @IsOptional()
        @IsString()
        systemPrompt: string;

        @IsOptional()
        @IsString()
        userPrompt: string;

        @IsOptional()
        @IsEnum(OB1Prompt.PromptStatus)
        promptStatus?: OB1Prompt.PromptStatus = OB1Prompt.PromptStatus.DRAFT;

        @IsOptional()
        @IsObject()
        @ValidateNested()
        @Type(() => LLMConfigDto)
        promptDefaultConfig: LLMConfigDto;

        @IsOptional()
        @IsArray()
        promptAvailableTools?: string[];  //only the toolId's in Array

        @IsOptional()
        @IsArray()
        promptAvailableActivities?: string[];  //only the activityId's in Array

        @IsOptional()
        @IsArray()
        promptAvailableWorkflows?: string[];  //only the workflowId's in Array

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
        @IsOptional() å
        promptResponseFormat?: OB1LLM.ResponseFormatJSONSchema;

        @IsBoolean()
        validationRequired: boolean;

        @IsBoolean()
        validationGate: boolean;
    }

    export class ExecutePromptBaseDto {

        @IsString()
        promptId: string;

        @IsOptional()
        @IsObject()
        toolENVInputVariables?: Record<string, any>;

        @IsOptional()
        @IsObject()
        activityENVInputVariables?: Record<string, any>;

        @IsOptional()
        @IsObject()
        workflowENVInputVariables?: Record<string, any>;

        @IsOptional()
        @IsObject()
        systemPromptVariables?: {
            [key: string]: any;
        };

        // //tracing
        // @Type(() => OB1LLM.promptTracing)
        // tracing: OB1LLM.promptTracing;
        // //metadata dictionary 

        @IsString()
        requestId: string;


        @IsObject()
        requestMetadata: Record<string, any>;

        @IsOptional()
        @IsObject()
        llmConfig?: LLMConfigDto;

        @IsOptional()
        @IsObject()
        promptConfig?: Record<string, any>;

        @IsOptional()
        @IsString()
        consultantOrgShortName?: string;

        @IsOptional()
        @IsString()
        personId?: string;
    }

    export class ExecutePromptWithUserPromptDto extends ExecutePromptBaseDto {
        @IsOptional()
        @IsString()
        userPrompt: string;

        @IsOptional()
        @IsArray()
        @ValidateNested({ each: true })
        messageHistory?: (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[];

    }

    export class ExecutePromptWithoutUserPromptDto extends ExecutePromptBaseDto {
        @IsOptional()
        @IsObject()
        userPromptVariables: {
            [key: string]: any;
        };

        @IsOptional()
        @IsArray()
        @ValidateNested({ each: true })
        @Type(() => OB1LLM.NonToolMessage) // Use correct type here
        @Expose()
        messageHistory?: (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[];
    }


    export class ListPromptsQueryDto {
        @IsOptional()
        @IsEnum(OB1Prompt.PromptStatus)
        status?: OB1Prompt.PromptStatus;

        @IsOptional()
        @IsString()
        category?: string;

        @IsOptional()
        @IsString()
        search?: string;

        @IsUUID()
        personId: string;

        @IsOptional()
        @IsNumber()
        page?: number;

        @IsOptional()
        @IsNumber()
        limit?: number;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
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

    export class CreateCategory {
        @IsString()
        promptCategoryName: string;

        @IsString()
        promptCategoryDescription: string;

        @IsString()
        consultantOrgShortName: string;

        @IsUUID()
        personId: string;
    }
    export class GetCategory {
        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    export class UpdateCategory {
        @IsString()
        @IsOptional()
        promptCategoryName?: string;

        @IsString()
        @IsOptional()
        promptCategoryDescription?: string;
    }
}
