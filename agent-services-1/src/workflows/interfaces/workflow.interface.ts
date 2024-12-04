// /src/workflows/interfaces/workflow.interface.ts

export namespace OB1Workflow {
    export enum WorkflowLang {
        TYPESCRIPT = 'TypeScript',
        PYTHON = 'Python',
        // Add other languages as needed
    }

    export enum WorkflowType {
        TEMPORAL = 'Temporal',
        LAMBDA = 'Lambda',
        // Add other types as needed
    }

    export interface CreateWorkflow {
        workflowName: string;
        workflowExternalName: string;
        workflowDescription: string;
        workflowCode: string;
        workflowMockCode: string;
        workflowInputSchema: Record<string, any>;
        workflowOutputSchema: Record<string, any>;
        workflowImports?: string[];
        workflowLang: WorkflowLang;
        workflowType: WorkflowType;
        workflowCategoryId: string;
        activitiesUsedByWorkflow: string[]; // Array of activity UUIDs
        consultantOrgShortName: string;
        personId: string;
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
        workflowCode: string;
        workflowMockCode: string;
        workflowInputSchema: Record<string, any>;
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
        activitiesUsedByWorkflow: Array<{
            activityId: string;
            activityName: string;
        }>;
        workflowCreatedAt: Date;
        workflowUpdatedAt: Date;
        workflowCreatedByPersonId: string;
        workflowCreatedByConsultantOrgShortName: string;
        workflowVersion: number;
    }

    export interface WorkflowQueryParams {
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
}
