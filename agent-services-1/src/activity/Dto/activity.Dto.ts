// /scr/activity/Dto/activity.Dto.ts

import { IsNotEmpty, IsString, IsOptional, IsUUID, IsObject, IsArray, IsEnum } from 'class-validator';
import { OB1Activity } from '../interfaces/activity.interface';

export namespace OB1ActivityDto {
    export class CreateActivityDto {
        @IsNotEmpty()
        @IsString()
        activityName: string;

        @IsOptional()
        @IsString()
        activityDescription?: string;

        @IsNotEmpty()
        @IsString()
        activityCode: string;

        @IsNotEmpty()
        @IsString()
        activityMockCode: string;

        @IsNotEmpty()
        @IsEnum(OB1Activity.ActivityLang)
        activityLang: OB1Activity.ActivityLang;

        @IsOptional()
        @IsEnum(OB1Activity.ActivityType)
        activityType?: OB1Activity.ActivityType;

        @IsNotEmpty()
        @IsObject()
        activityInputSchema: Record<string, any>;

        @IsNotEmpty()
        @IsObject()
        activityOutputSchema: Record<string, any>;

        @IsOptional()
        @IsArray()
        activityImports?: string[];

        @IsUUID()
        activityCategoryId: string;

        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    // export class UpdateActivityDto {
    //     @IsOptional()
    //     @IsString()
    //     activityName?: string;

    //     @IsOptional()
    //     @IsString()
    //     activityDescription?: string;

    //     @IsOptional()
    //     @IsString()
    //     activityCode?: string;

    //     @IsOptional()
    //     @IsJSON()
    //     activityInputSchema?: Record<string, any>;

    //     @IsOptional()
    //     @IsJSON()
    //     activityOutputSchema?: Record<string, any>;

    //     @IsUUID()
    //     activityCategoryId: string;

    //     @IsUUID()
    //     personId: string;

    //     @IsNotEmpty()
    //     @IsString()
    //     consultantOrgShortName: string;
    // }

    export class ActivityQueryParamsDto {
        @IsOptional()
        @IsUUID()
        activityCategoryId?: string;

        @IsOptional()
        @IsString()
        search?: string;

        @IsOptional()
        @IsNotEmpty()
        page?: number;

        @IsOptional()
        @IsNotEmpty()
        limit?: number;

        @IsNotEmpty()
        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    // DTO for Creating a Category
    export class CreateCategoryDto {
        @IsNotEmpty()
        @IsString()
        activityCategoryName: string;

        @IsNotEmpty()
        @IsString()
        activityCategoryDescription: string;

        @IsNotEmpty()
        @IsUUID()
        personId: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }

    // DTO for Updating a Category
    export class UpdateCategoryDto {
        @IsOptional()
        @IsString()
        activityCategoryName?: string;

        @IsOptional()
        @IsString()
        activityCategoryDescription?: string;

        @IsNotEmpty()
        @IsString()
        consultantOrgShortName: string;
    }
}
