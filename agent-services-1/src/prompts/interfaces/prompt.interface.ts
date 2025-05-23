import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { DynamicObjectValidator } from '../Dto/DynamicObject.validator'
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';


export namespace OB1Prompt {

    export enum DefaultPromptConfig {
        DEFAULT_MAX_LLM_CALLS = 5,
        DEFAULT_MAX_TOOL_CALLS = 5,
        DEFAULT_MAX_TOOL_EXECUTION_TIME = 120000, //120 secs, will adjust in future
        DEFAULT_VALIDATION_GATE_RETRY = 3,
    }

    export enum PromptStatus {
        DRAFT = 'DRAFT',
        ACTIVE = 'ACTIVE',
        ARCHIVED = 'ARCHIVED'
    }

    export interface ExecutePromptGlobalBase {

        prompt: OB1AgentPrompts;
        systemPrompt: string;
        userPrompt?: string;
        availableTools?: Array<OB1LLM.InputTool>;
        toolENVInputVariables?: Record<string, any>;
        activityENVInputVariables?: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;

        promptId: string;
        systemPromptVariables?: Record<string, any>;
        userPromptVariables?: Record<string, any>;

        requestId: string;
        requestMetadata: Record<string, any>;

        llmConfig?: Partial<OB1LLM.LLMConfig>;
        promptInputENV?: Record<string, any>;
        promptConfig?: {
            maxToolCalls?: number;
            maxLLMCalls?: number;
            toolTimeout?: number;
            maxTotalExecutionTime?: number;
        };
        availableToolSet?: Set<string>;
        availableWorkflowSet?: Set<string>;
        availableActivitySet?: Set<string>;
        
        consultantOrgShortName?: string;
        personId?: string;
        validationRequired?: boolean;
        messageHistory?: (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[];

    }

    export interface ExecutePromptWithToolsBase {
        promptId: string;
        systemPromptVariables?: Record<string, any>;
        toolInputENV?: Record<string, any>;

        requestId: string;
        requestMetadata: Record<string, any>;

        llmConfig?: Partial<OB1LLM.LLMConfig>;
        promptInputENV?: Record<string, any>;
        promptConfig?: {
            maxToolCalls?: number;
            maxLLMCalls?: number;
            toolTimeout?: number;
            maxTotalExecutionTime?: number;
        };
        consultantOrgShortName?: string;
        personId?: string;

        toolENVInputVariables?: Record<string, any>;
        activityENVInputVariables?: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;
    }

    export interface ExecutePromptWithUserPrompt extends ExecutePromptWithToolsBase {
        userPrompt: string;
    }

    export interface ExecutePromptResponseAsync {
        requestId: string;
        requestMetadata: Record<string, any>;
        requestorId: string;
    }

    export interface ExecutePromptWithoutUserPrompt extends ExecutePromptWithToolsBase {
        userPromptVariables: Record<string, any>;

        messageHistory?: (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[];
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

    export class LLMConfig {
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
        @Type(() => LLMConfig)
        promptDefaultConfig: LLMConfig;

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

        consultantOrgShortName: string;
        personId: string;

    }


    // export class UpdatePromptDto extends CreatePrompt {
    //     @IsOptional()
    //     @IsEnum(PromptStatus)
    //     promptStatus?: PromptStatus;
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
    export interface UpdatePrompt {
        // Fields that can be updated
        promptDescription?: string;
        promptStatus?: PromptStatus;
        systemPrompt?: string;
        userPrompt?: string;
        systemPromptVariables?: Record<string, {
            type: string;
            description: string;
            required: boolean;
            defaultValue?: any;
        }>;
        userPromptVariables?: Record<string, {
            type: string;
            description: string;
            required: boolean;
            defaultValue?: any;
        }>;
        promptDefaultConfig?: {
            provider: OB1LLM.LLMProvider;
            model: OB1LLM.AnthropicModels | OB1LLM.OpenAIModels;
            temperature?: number;
            maxTokens?: number;
            maxLLMCalls: number;
            maxToolCalls: number;
            maxTotalExecutionTime: number;
            timeout: {
                llmCall: number;
                promptCall: number;
            };
            maxToolCallsPerType: Record<string, number>;
        };
        promptAvailableTools?: string[];
        promptResponseFormat?: OB1LLM.ResponseFormatJSONSchema;
    }

    export interface CategoryResponse {
        promptCategoryId: string;
        promptCategoryName: string;
        promptCategoryDescription: string;
        promptCategoryCreatedByPersonId: string;
        promptCategoryCreatedByConsultantOrgShortName: string;
    }

    export interface PromptResponse {
        promptId: string;
        promptName: string;
        promptExternalName: string;
        promptDescription: string;
        promptCategory?: {
            promptCategoryId: string;
            promptCategoryName: string;
        };
        promptStatus: OB1Prompt.PromptStatus;
        promptAvailableTools: string[];
        promptToolChoice?: OB1LLM.ChatCompletionToolChoiceOption;
        promptCreatedAt: Date;
        promptUpdatedAt: Date;
        promptExecutionCount: number;
    }

    export class PromptResponseDto {
        promptId: string;
        promptName: string;
        promptExternalName: string;
        promptDescription: string;
        promptCategory?: {
            promptCategoryId: string;
            promptCategoryName: string;
            promptCategoryCreatedByConsultantOrgShortName: string;
        };
        promptStatus: OB1Prompt.PromptStatus;
        promptVersion: number;
        promptCreatedByConsultantOrgShortName: string;
        promptCreatedByPersonId: string;
        systemPrompt: string;
        userPrompt?: string;
        systemPromptVariables: Record<string, {
            type: string;
            description: string;
            required: boolean;
            defaultValue?: any;
        }>;
        userPromptVariables: Record<string, {
            type: string;
            description: string;
            required: boolean;
            defaultValue?: any;
        }>;
        promptDefaultConfig: {
            provider: OB1LLM.LLMProvider;
            model: OB1LLM.AnthropicModels | OB1LLM.OpenAIModels;
            temperature?: number;
            maxTokens?: number;
            maxLLMCalls: number;
            maxToolCalls: number;
            maxTotalExecutionTime: number;
            timeout: {
                llmCall: number;
                promptCall: number;
            };
            maxToolCallsPerType: Record<string, number>;
        };
        promptAvailableTools: string[];
        promptToolChoice?: OB1LLM.ChatCompletionToolChoiceOption;
        promptCreatedAt: Date;
        promptUpdatedAt: Date;
        promptExecutionCount: number;
        promptResponseFormat?: OB1LLM.ResponseFormatJSONSchema;
        promptAvgResponseTime: number;
    }

    export interface ServiceResponse<T> {
        success: boolean;
        data?: T;
        error?: {
            code: string;
            message: string;
            details?: any;
        };
    }
    export interface PaginatedResponse<T> {
        items: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }
    export interface WorkflowQueryParams {
        consultantOrgShortName: string;
        status?: PromptStatus;
        category?: string;
        search?: string;
        page?: number;
        limit?: number;
    }

    export interface PromptUpdateResult {
        previousVersion: PromptResponse;
        updatedVersion: PromptResponse;
        changes: string[];
    }

    export interface ValidationWeights {
        relevance: number;
        toolUsage: number;
        completeness: number;
        consistency: number;
        edgeCases: number;
    }
    
    export interface ValidationConfig {
        threshold?: number;
        weights?: Partial<ValidationWeights>;
    }
    
    export interface ValidationMetrics {
        relevanceScore: number;
        toolUsageScore: number;
        clarityScore: number;
        accuracyScore: number;
    }
    
    export interface ValidationExplanations {
        relevanceAnalysis: string[];
        toolUsageAnalysis: string[];
        clarityAnalysis: string[];
        accuracyAnalysis: string[];
    }
    
    export interface ValidationCriticalIssues {
        issue?: string;
        impact?: string;
        recommendation?: string;
    }
    
    export interface ValidationScore {
        metrics: ValidationMetrics;
        explanations: ValidationExplanations;
        criticalIssues?: ValidationCriticalIssues[];
        overallScore: number;
        passed: boolean;
    }
    
    export interface ValidationRequest {
        originalPrompts: {
            systemPrompt: string;
            userPrompt: string;
        };
        toolCallHistory: OB1Tool.ToolCallLog[];
        finalResponse: any;
        validationConfig?: ValidationConfig;
        tracing: OB1LLM.promptTracing;
        requestMetadata?: Record<string, any>;

    }
    export const DEFAULT_WEIGHTS: ValidationWeights = {
        relevance: 0.3,
        toolUsage: 0.2,
        completeness: 0.2,
        consistency: 0.2,
        edgeCases: 0.1
    };
}
