export namespace OB1Activity {

    export enum ActivityLang {
        PYTHON = 'python',
        TYPESCRIPT = 'typescript',
        JAVASCRIPT = 'javascript',
        GO = 'go',
    }

    export enum ActivityType {
        TEMPORAL = 'temporal',
        LAMBDA = 'lambda',
    }

    export interface CreateActivity {
        activityName: string;
        activityDescription?: string;
        activityCode: string;
        activityMockCode: string;
        activityLang: OB1Activity.ActivityLang;
        activityType?: OB1Activity.ActivityType;
        activityInputSchema: Record<string, any>;
        activityENVInputSchema?: Record<string, any>;
        activityOutputSchema: Record<string, any>;
        activityCategoryId: string;
        personId: string;
        consultantOrgShortName: string;
        activityImports?: string[];
    }

    export interface UpdateActivity {
        activityName?: string;
        activityDescription?: string;
        activityCode?: string;
        activityMockCode?: string;
        activityLang?: OB1Activity.ActivityLang;
        activityType?: OB1Activity.ActivityType;
        activityInputSchema?: Record<string, any>;
        activityENVInputSchema?: Record<string, any>;
        activityOutputSchema?: Record<string, any>;
        activityCategoryId: string;
        personId: string;
        consultantOrgShortName: string;
    }

    export interface ActivityQueryParams {
        activityCategoryId?: string;
        search?: string;
        page?: number;
        limit?: number;
        personId: string;
        consultantOrgShortName: string;
    }

    export interface ActivityResponse {
        activityId: string;
        activityName: string;
        activityExternalName: string;
        activityDescription: string;
        activityCategory?: ActivityCategory;
        activityCreatedAt: Date;
        activityUpdatedAt: Date;
    }

    export class ActivityResponseDto {
        activityId: string;
        activityName: string;
        activityExternalName: string;
        activityDescription: string;
        activityCode: string;
        activityMockCode: string;
        activityInputSchema: Record<string, any>;
        activityENVInputSchema?: Record<string, any>;
        activityOutputSchema: Record<string, any>;
        activityCategory?: ActivityCategory;
        activityCreatedAt: Date;
        activityUpdatedAt: Date;
        activityCreatedByPersonId: string;
        activityCreatedByConsultantOrgShortName: string;
    }

    export interface ActivityCategory {
        activityCategoryId: string;
        activityCategoryName: string;
        activityCreatedByConsultantOrgShortName?: string;
    }

    export interface ActivityStandardInputSchemaConfig {
        activityENVInputVariables?: Record<string, any>;

        //add others as needed
    }

    export interface ActivityStandardInputSchema {
        input: Record<string, any>;
        config?: ActivityStandardInputSchemaConfig;
    }

    export interface ActivityStandardOutputSchema {
        output: Record<string, any>;
        executionDetails: Record<string, any>;
    }

    export interface ServiceResponse<T> {
        success: boolean;
        data?: T;
        error?: {
            code: string;
            message: string;
            details?: Record<string, any>;
        };
    }

    export interface PaginatedResponse<T> {
        items: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }

    export interface ActivityUpdateResult {
        previousVersion: ActivityResponse;
        updatedVersion: ActivityResponse;
        changes: string[];
    }

    export interface ActivityTestResponse {
        activityResponse: any;
        activityResponseValidationTestResult: { isValid: boolean; errors: string[] };
        activityResponseValidationTestPass: boolean;
    }

    // Create Category Interface
    export interface CreateCategory {
        activityCategoryName: string;
        activityCategoryDescription: string;
        personId: string;
        consultantOrgShortName: string;
    }
    export interface GetCategory {
        consultantOrgShortName: string;
    }

    // Update Category Interface
    export interface UpdateCategory {
        activityCategoryName?: string;
        activityCategoryDescription?: string;
        consultantOrgShortName: string;
    }

    // Category Response Interface
    export interface CategoryResponse {
        activityCategoryId: string;
        activityCategoryName: string;
        activityCategoryDescription: string;
        activityCategoryCreatedBypersonId: string;
        activityCategoryCreatedByConsultantOrgShortName: string;
    }

    //REGION - EXECUTION
    export interface ActivityLoadingRequest {
        activityCode: string;
        imports: Set<string>;
        workflowExternalName: string;
    }
    export interface ActivityLoadingRequestV2 {
        workflowExternalName: string;
        workflowId: string;
        workflowActivityImportMap?: Map<string, Set<string>>;
        workflowActivityCodeMap?: Map<string, string>;
    }
    export interface ActivityLoadingResponse {
        activityCode: string;
    }
}