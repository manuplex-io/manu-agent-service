import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { LLMProvider, AnthropicModels, OpenAIModels } from '../../llms/interfaces/llm.interfaces';


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
    @ValidateVariables()
    systemPromptVariables: {
        [key: string]: VariableDefinitionDto;
    };

    @IsOptional()
    @IsObject()
    @ValidateVariables()
    userPromptVariables: {
        [key: string]: VariableDefinitionDto;
    };


}



export class UpdatePromptDto extends CreatePromptDto {
    @IsOptional()
    @IsEnum(PromptStatus)
    promptStatus?: PromptStatus;
}

export class ExecutePromptDto {
    @IsOptional()
    @IsString()
    userPrompt: string;

    @IsOptional()
    @IsObject()
    userVariables?: Record<string, any>;

    @IsOptional()
    @IsObject()
    systemVariables?: Record<string, any>;

    @IsOptional()
    @IsObject()
    llmConfig?: Record<string, any>;
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