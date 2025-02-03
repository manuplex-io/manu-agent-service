import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1LLM } from 'src/llms/interfaces/llmV2.interfaces';

export const CRUDOperationName = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
} as const;

export type CRUDOperationNameType = typeof CRUDOperationName[keyof typeof CRUDOperationName];

export const CRUDPromptRoute = {
    LIST_PROMPTS: 'prompts',
    GET_PROMPT: 'prompts/:promptId',
    CREATE_PROMPT: 'prompts',
    UPDATE_PROMPT: 'prompts/:promptId',
    DELETE_PROMPT: 'prompts/:promptId',

    // Prompt category endpoints
    LIST_CATEGORIES: 'prompts/categories',
    CREATE_CATEGORY: 'prompts/categories',
    UPDATE_CATEGORY: 'prompts/categories/:categoryId',
    DELETE_CATEGORY: 'prompts/categories/:categoryId',

    // Prompt execution endpoints
    EXECUTE_WITH_USER_PROMPT: 'prompts/:promptId/executeWithUserPrompt',
    EXECUTE_WITHOUT_USER_PROMPT: 'prompts/:promptId/executeWithoutUserPrompt',
    EXECUTE_WITH_USER_PROMPT_ASYNC: 'prompts/:promptId/executeWithUserPromptAsync',
    EXECUTE_WITHOUT_USER_PROMPT_ASYNC: 'prompts/:promptId/executeWithoutUserPromptAsync',
    GET_EXECUTION_LOGS: 'prompts/:promptId/logs'
} as const;

export type CRUDPromptRouteType = typeof CRUDPromptRoute[keyof typeof CRUDPromptRoute];

export const CRUDToolRoute = {
    // Tool endpoints
    LIST_TOOLS: 'tools',
    GET_TOOL: 'tools/:id',
    GET_TOOL_EXTERNAL_NAME: 'tools/externalName/:externalName',
    GET_TOOL_IDS_BY_EXTERNAL_NAMES: 'tools/externalNames',
    GET_TOOL_FIELDS: 'tools/fields',
    // GET_FULL_TOOL: 'tools/fullDetails/:id',
    CREATE_TOOL: 'tools',
    UPDATE_TOOL: 'tools/:id',
    DELETE_TOOL: 'tools/:id',

    // Category endpoints
    LIST_CATEGORIES: 'tools/categories',
    CREATE_CATEGORY: 'tools/categories',
    UPDATE_CATEGORY: 'tools/categories/:id',
    DELETE_CATEGORY: 'tools/categories/:id',

    // Tool execution endpoints
    VALIDATE_TOOL: 'tools/validate',
    DEPLOY_TOOL: 'tools/deploy/:toolId',
    TEST_TOOL: 'tools/test/:toolId',
} as const;

export type CRUDToolRouteType = typeof CRUDToolRoute[keyof typeof CRUDToolRoute];

export const CRUDActivityRoute = {
    // Activity endpoints
    LIST_ACTIVITIES: 'activities',
    GET_ACTIVITY: 'activities/:id',
    CREATE_ACTIVITY: 'activities',
    UPDATE_ACTIVITY: 'activities/:id',
    DELETE_ACTIVITY: 'activities/:id',

    // Category endpoints
    LIST_CATEGORIES: 'activities/categories',
    CREATE_CATEGORY: 'activities/categories',
    UPDATE_CATEGORY: 'activities/categories/:id',
    DELETE_CATEGORY: 'activities/categories/:id',

    // Activity testing endpoints
    TEST_ACTIVITY: 'activities/test/:activityId',
    VALIDATE_ACTIVITY_ONLY: 'activities/validateOnly/:activityId',
} as const;

export type CRUDActivityRouteType = typeof CRUDActivityRoute[keyof typeof CRUDActivityRoute];


export const CRUDWorkflowRoute = {
    // Workflow endpoints
    LIST_WORKFLOWS: 'workflows',
    GET_WORKFLOW: 'workflows/:id',
    CREATE_WORKFLOW: 'workflows',
    UPDATE_WORKFLOW: 'workflows/:id',
    DELETE_WORKFLOW: 'workflows/:id',

    // Workflow Category endpoints
    LIST_CATEGORIES: 'workflows/categories',
    CREATE_CATEGORY: 'workflows/categories',
    UPDATE_CATEGORY: 'workflows/categories/:workflowCategoryId',
    DELETE_CATEGORY: 'workflows/categories/:workflowCategoryId',

    // Workflow testing endpoints
    TEST_WORKFLOW: 'workflows/test/:workflowId',
    VALIDATE_WORKFLOW_ONLY: 'workflows/validateOnly/:workflowId',

    // Workflow execution V1 endpoints
    EXECUTE_WORKFLOW: 'workflows/execute/:workflowId',
    EXECUTE_WORKFLOW_SYNC: 'workflows/executeSync/:workflowId',
    EXECUTE_WORKFLOW_ASYNC: 'workflows/executeAsync/:workflowId',
    EXECUTE_WORKFLOW_SCHEDULED: 'workflows/executeScheduled/:workflowId',
    EXECUTE_WORKFLOW_ASYNC_MULTIPLE: 'workflows/executeAsyncMultiple/:workflowId',

    GET_WORKFLOW_EXECUTION_STATUS: 'workflows/executionStatus/:workflowExecutionId',
    GET_WORKFLOW_SCHEDULE_STATUS: 'workflows/scheduleStatus/:temporalWorkflowId',
    GET_WORKFLOW_CODE: 'workflows/getCode',

    // Workflow execution V2 endpoints
    EXECUTE_WORKFLOW_V2: 'workflows/executeV2/:workflowId',
    EXECUTE_WORKFLOW_SYNC_V2: 'workflows/executeSyncV2/:workflowId',
    EXECUTE_WORKFLOW_ASYNC_V2: 'workflows/executeAsyncV2/:workflowId',
    EXECUTE_WORKFLOW_SCHEDULED_V2: 'workflows/executeScheduledV2/:workflowId',
    EXECUTE_WORKFLOW_ASYNC_MULTIPLE_V2: 'workflows/executeAsyncMultipleV2/:workflowId',
    EXECUTE_ACTIVITY_AS_WORKFLOW_V2: 'workflows/executeActivityAsWorkflowV2/:activityId',

    GET_WORKFLOW_EXECUTION_STATUS_V2: 'workflows/executionStatusV2/:workflowExecutionId',
    GET_WORKFLOW_SCHEDULE_STATUS_V2: 'workflows/scheduleStatusV2/:temporalWorkflowId',
    GET_WORKFLOW_CODE_V2: 'workflows/getCodeV2',

} as const;

export type CRUDWorkflowRouteType = typeof CRUDWorkflowRoute[keyof typeof CRUDWorkflowRoute];

export const CRUDRAGRoute = {
    // Workflow endpoints
    CREATE_DATASET: 'rags',
} as const;

export type CRUDRAGRouteType = typeof CRUDRAGRoute[keyof typeof CRUDRAGRoute];

export const CRUDLLMRoute = {
    // Workflow endpoints
    GENERATE_LLM_RESPONSE: 'llm',
    GENERATE_LLM_RESPONSE_WITH_RAG: 'llm/rag',
} as const;

export type CRUDLLMRouteType = typeof CRUDLLMRoute[keyof typeof CRUDLLMRoute];

export class CRUDRouteParams {
    @IsOptional()
    @IsString()
    promptId?: string;

    @IsOptional()
    @IsString()
    promptCategoryId?: string;

    @IsOptional()
    @IsString()
    toolId?: string;

    @IsOptional()
    @IsString()
    toolCategoryId?: string;

    @IsOptional()
    @IsString()
    activityId?: string;

    @IsOptional()
    @IsString()
    activityCategoryId?: string;

    @IsOptional()
    @IsString()
    workflowId?: string;

    @IsOptional()
    @IsString()
    workflowCategoryId?: string;

    @IsOptional()
    @IsString()
    temporalWorkflowId?: string;
}

export class CRUDFunctionInput {
    @IsString()
    @IsEnum(CRUDOperationName)
    CRUDOperationName: CRUDOperationNameType;

    @IsString()
    @IsEnum([...Object.values(CRUDPromptRoute), ...Object.values(CRUDToolRoute), ...Object.values(CRUDActivityRoute), ...Object.values(CRUDWorkflowRoute), ...Object.values(CRUDLLMRoute), ...Object.values(CRUDRAGRoute)]) // Combine routes
    CRUDRoute: CRUDPromptRouteType | CRUDToolRouteType | CRUDActivityRouteType | CRUDWorkflowRouteType | CRUDLLMRouteType | CRUDRAGRouteType;

    @IsOptional()
    @IsObject()
    CRUDBody?: any;

    @IsOptional()
    @ValidateNested()
    @Type(() => CRUDRouteParams)
    routeParams?: CRUDRouteParams;

    @IsOptional()
    @IsObject()
    queryParams?: Record<string, any>;

    @IsOptional()
    @IsObject()
    personPayload?: Record<string, any>;

    @Type(() => OB1LLM.promptTracing)
    tracing?: OB1LLM.promptTracing;

    @IsOptional()
    @IsObject()
    requestMetadata?: Record<string, any>;

}

export class CRUDFunctionInputExtended extends CRUDFunctionInput {

    // @Type(() => OB1LLM.promptTracing)
    // tracing: OB1LLM.promptTracing;

    requestId: string;
}