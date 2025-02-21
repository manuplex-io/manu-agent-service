// /src/workflows/interfaces/workflow.interface.ts

import { OB1AgentActivities } from "src/activity/entities/ob1-agent-activities.entity";
import { OB1AgentWorkflows } from "src/workflows/entities/ob1-agent-workflows.entity";

export namespace OB1Workflow {
    export enum WorkflowLang {
        TYPESCRIPT = 'typescript',
        PYTHON = 'python',
        // Add other languages as needed
    }

    export enum WorkflowType {
        TEMPORAL = 'temporal',
        LAMBDA = 'lambda',
        // Add other types as needed
    }

    export enum WorkflowExecutionType {
        SYNC = 'sync',
        ASYNC = 'async',
        SCHEDULED = 'scheduled',
        ASYNC_MULTIPLE = 'asyncMultiple',
        ACTIVITY_AS_WORKFLOW = 'activityAsWorkflow',
    }

    export interface CreateWorkflow {
        workflowName: string;
        workflowExternalName: string;
        workflowDescription: string;
        workflowCode: string;
        workflowMockCode: string;
        workflowInputSchema: Record<string, any>;
        workflowENVInputSchema: Record<string, any>;
        workflowOutputSchema: Record<string, any>;
        workflowImports?: string[];
        workflowLang: WorkflowLang;
        workflowType: WorkflowType;
        workflowCategoryId: string;
        activitiesUsedByWorkflow: string[]; // Array of activity UUIDs
        consultantOrgShortName: string;
        personId: string;
    }

    export interface ValidateWorkflow extends CreateWorkflow {
        subWorkflows?: OB1AgentWorkflows[];
    }

    // add more fields as needed for workflow validation response
    export interface ValidateWorkflowRespose {
        workflowCode: string;
    }

    export interface UpdateWorkflow {
        // Fields that can be updated
        workflowDescription?: string;
        workflowCode?: string;
        workflowMockCode?: string;
        workflowInputSchema?: Record<string, any>;
        workflowOutputSchema?: Record<string, any>;
        workflowImports?: string[];
        activitiesUsedByWorkflow?: string[]; // Array of activity UUIDs
    }

    export interface WorkflowResponse {
        workflowId: string;
        workflowName: string;
        workflowDescription: string;
        workflowLang: WorkflowLang;
        workflowType: WorkflowType;
        workflowExternalName: string;
        workflowCategory?: {
            workflowCategoryId: string;
            workflowCategoryName: string;
        };
        activitiesUsedByWorkflow: Array<{
            activityId: string;
            activityName: string;
        }>;
        workflowCreatedAt: Date;
        workflowUpdatedAt: Date;
    }

    export class WorkflowResponseDto {
        workflowId: string;
        workflowName: string;
        workflowDescription: string;
        workflowCode: string;
        workflowMockCode: string;
        workflowInputSchema: Record<string, any>;
        workflowENVInputSchema?: Record<string, any>;
        workflowOutputSchema: Record<string, any>;
        workflowImports?: string[];
        workflowLang: WorkflowLang;
        workflowType: WorkflowType;
        workflowExternalName: string;
        workflowCategory?: {
            workflowCategoryId: string;
            workflowCategoryName: string;
            workflowCategoryCreatedByConsultantOrgShortName: string;
        };
        workflowCreatedAt: Date;
        workflowUpdatedAt: Date;
        workflowCreatedByPersonId: string;
        workflowCreatedByConsultantOrgShortName: string;
        workflowVersion: number;
    }

    export interface WorkflowQueryParams {
        consultantOrgShortName: string;
        workflowCategoryId?: string;
        search?: string;
        page?: number;
        limit?: number;
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

    export interface WorkflowUpdateResult {
        previousVersion: WorkflowResponse;
        updatedVersion: WorkflowResponse;
        changes: string[];
    }

    //workflowCaetegory

    export interface CreateCategory {
        workflowCategoryName: string;
        workflowCategoryDescription: string;
        consultantOrgShortName: string;
        personId: string;
    }

    export interface GetCategory {
        consultantOrgShortName: string;
    }

    export interface UpdateCategory {
        workflowCategoryName?: string;
        workflowCategoryDescription?: string;
    }

    export interface CategoryResponse {
        workflowCategoryId: string;
        workflowCategoryName: string;
        workflowCategoryDescription: string;
        workflowCategoryCreatedByPersonId: string;
        workflowCategoryCreatedByConsultantOrgShortName: string;
    }

    // Other interfaces...

    export interface ServiceResponse<T> {
        success: boolean;
        data?: T;
        error?: {
            code: string;
            message: string;
            details?: any;
        };
    }

    export interface WorkflowTestResponse {
        workflowResult: any;
        workflowResponseValidationTestResult: {
            isValid: boolean;
            errors: string[];
        };
        workflowResponseValidationTestPass: boolean;
    }

    export interface WorkflowExecuteRequest {
        workflowId: string;
        workflowInputVariables: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;
        workflowScheduleConfig?: {
            interval?: string;
            startTime?: Date;
            endTime?: Date;
            cronExpression?: string;
        };
        requestId: string;
        requestMetadata: Record<string, any>;
        workflowExecutionConfig: {
            workflowQueueName: string
        };
        consultantOrgShortName: string;
        personId: string;
        workflowExecutionType: 'sync' | 'async' | 'scheduled' | 'asyncMultiple';
        workflowIds?: string[];
    }

    export interface WorkflowExecutionResponse {
        workflowExecutionResult: {
            isStarted: boolean;
            errors: string[];
            result?: any;
            workflowQueueName: string;
            temporalWorkflowId?: string;
            temporalScheduleId?: string;
            status: "UNKNOWN" | "UNSPECIFIED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TERMINATED" | "CONTINUED_AS_NEW" | "TIMED_OUT";
        };
    }

    export interface ActivitySubServiceExecuteRequest {
        activityId: string;
        workflowIds?: string[];
        workflowInputVariables: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;
        workflowScheduleConfig?: {
            interval?: string;
            startTime?: Date;
            endTime?: Date;
            cronExpression?: string;
        };
        requestId: string;
        requestMetadata?: Record<string, any>;
        workflowExecutionConfig?: {
            workflowQueueName?: string
        };
        consultantOrgShortName: string;
        personId: string;
    }

    export interface WorkflowSubServiceExecuteRequest {
        workflow: OB1AgentWorkflows;
        workflowId: string;
        workflowIds?: string[];
        workflowInputVariables: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;
        workflowScheduleConfig?: {
            interval?: string;
            startTime?: Date;
            endTime?: Date;
            cronExpression?: string;
        };
        requestId: string;
        requestMetadata?: Record<string, any>;
        workflowExecutionConfig?: {
            workflowQueueName?: string
        };
        consultantOrgShortName: string;
        personId: string;
    }

    export interface ActivityExecuteAsWorkflowRequest {
        activityId: string;
        workflowInputVariables: Record<string, any>;
        workflowENVInputVariables?: Record<string, any>;
        requestId: string;
        requestMetadata?: Record<string, any>;
        workflowExecutionConfig?: {
            workflowQueueName?: string
        };
        consultantOrgShortName: string;
        personId: string;
    }

    export interface ActivityToWorkflowRequest {
        activityCode: string;
        activityExternalName: string;
        activityId: string;
    }

    export interface WorkflowLoadingResponse {
        activityIds: Array<string>;
        workflowExternalName: string;
        workflowCode?: string;
        activities?: Array<Record<string, any>>;
        activityCode?: string;
        activityENVInputSchemas?: Array<Record<string, any>>;
    }

    export interface WorkflowLoadingRequest {
        workflowCode: string;
        workflowExternalName: string;
    }
    export interface WorkflowLoadingRequestV2 {
        workflowCode: string;
        workflowExternalName: string;
        combinedWorkflows?: OB1AgentWorkflows[];
        workflowToSubworkflowsMap?: Map<string, string[]>;
    }
    export interface WorkflowValidationResponse {
        workflow: Record<string, any>;
        updatedWorkflowCode: string;
        updatedActivityCode: string;
        uniqueImports: Set<string>;
    }
    export interface WorkflowValidationResponseV2 {
        updatedWorkflowCode: string;
    }
    export interface WorkflowValidationRequest {
        workflowId: string;
        workflowENVInputVariables?: Record<string, any>;
    }
    export interface WorkflowValidationRequestV2 {
        mainWorkflow: OB1AgentWorkflows;
        workflowENVInputVariables?: Record<string, any>;
        workflowActivityCodeMap?: Map<string, string>;
        workflowUniqueActivityNames?: Map<string, Set<string>>;
        workflowActivityImportMap?: Map<string, Set<string>>;
    }
    export interface WorkflowValidationRequestMultiple extends WorkflowValidationRequest {
        workflowIds: string[];
    }

    export interface WorkflowENVLoadingRequest {
        workflowExternalName: string;
        workflowENVInputVariables: Record<string, any>;
        temporalWorkflowId: string;
    }

    export interface TemporalSearchAttributes{
        consultantOrgShortName: string[];
        personId: string[];
        userOrgId: string[];
    }
    export interface AllNestedWorkflowsResult {
        allWorkflows: OB1AgentWorkflows[];
        workflowToSubworkflowsMap: Map<string, string[]>;
        workflowActivityCodeMap: Map<string, string>;
        workflowActivityImportMap: Map<string, Set<string>>;
        workflowUniqueActivityNames: Map<string, Set<string>>;
    }
}