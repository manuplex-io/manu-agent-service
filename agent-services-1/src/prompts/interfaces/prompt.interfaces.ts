import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import {
    LLMProvider,
    AnthropicModels,
    OpenAIModels,
    promptTracing,
    RequestMetadata,
    ResponseFormatJSONSchema,
    Message,

} from '../../llms/interfaces/llmV2.interfaces';
import { DynamicObjectValidator } from './DynamicObject.validator'


export enum PromptStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED'
}

export enum PromptCategory {
    GENERAL = 'GENERAL',
    ANALYSIS = 'ANALYSIS',
    CODING = 'CODING',
    WRITING = 'WRITING',
    CUSTOM = 'CUSTOM',
    SALESFORCE = 'SALESFORCE',
}





// Custom decorator for validating variables structure
function ValidateVariables() {
    return function (object: any, propertyName: string) {
        ValidateNested()(object, propertyName);
    };
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
    provider: LLMProvider;

    //@IsOptional()
    @IsString()
    model: AnthropicModels | OpenAIModels;

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

    @IsEnum(PromptCategory)
    promptCategory: PromptCategory;

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
    promptResponseFormat?: ResponseFormatJSONSchema;
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

}


export class UpdatePromptDto extends CreatePromptDto {
    @IsOptional()
    @IsEnum(PromptStatus)
    promptStatus?: PromptStatus;
}

export class ExecutePromptwithUserPromptDto {
    @IsOptional()
    @IsString()
    userPrompt: string;

    @IsOptional()
    @IsObject()
    systemPromptVariables?: {
        [key: string]: any;
    };

    //tracing
    @Type(() => promptTracing)
    tracing: promptTracing;
    //metadata dictionary 

    @Type(() => RequestMetadata)
    requestMetadata: RequestMetadata;

    @IsOptional()
    @IsObject()
    llmConfig?: LLMConfigDto;
}

export class ExecutePromptWithUserPromptNoToolExec extends ExecutePromptwithUserPromptDto {
    @IsString()
    promptId: string;

}

export class ExecutePromptwithoutUserPromptDto {
    @IsOptional()
    @IsObject()
    userPromptVariables: {
        [key: string]: any;
    };

    @IsOptional()
    @IsObject()
    systemPromptVariables?: {
        [key: string]: any;
    };

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Message)
    messageHistory?: Message[];

    //tracing
    @Type(() => promptTracing)
    tracing: promptTracing;

    @Type(() => RequestMetadata)
    requestMetadata: RequestMetadata;

    @IsOptional()
    @IsObject()
    llmConfig?: LLMConfigDto;
}

export class ExecutePromptWithoutUserPromptNoToolExec extends ExecutePromptwithoutUserPromptDto {
    @IsString()
    promptId: string;


}

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