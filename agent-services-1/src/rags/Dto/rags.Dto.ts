import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsObject,
    IsArray,
    IsUUID,
    Min,
    IsNumber,
} from 'class-validator';

export namespace OB1RAGDto {

    export class CreateRAGDto {
        @IsNotEmpty()
        @IsString()
        context: string;

        @IsOptional()
        @IsObject()
        ragDataMetadata: Record<string, any>;

        @IsOptional()
        @IsString()
        consultantOrgShortName: string;

        @IsOptional()
        @IsString()
        personId: string;

        @IsOptional()
        @IsObject()
        ragExecutionConfig: Record<string, any>;
    }

}
