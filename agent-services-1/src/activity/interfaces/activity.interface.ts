export namespace OB1Activity {

    export enum ActivityLang {
        PYTHON = 'python',
        TYPESCRIPT = 'typeScript',
        JAVASCRIPT = 'javaScript',
        GO = 'go',
    }

    export enum ActivityType {
        TEMPORAL = 'temporal',
        LAMBDA = 'typescript',
    }

    export interface CreateActivity {
        activityName: string;
        activityDescription?: string;
        activityCode: string;
        activityMockCode: string;
        activityLang: OB1Activity.ActivityLang;
        activityType?: OB1Activity.ActivityType;
        activityInputSchema: Record<string, any>;
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
        activityCode: string;
        activityMockCode: string;
        activityInputSchema: Record<string, any>;
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
        activityCreatedByConsultantOrgShortName: string;
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
}
