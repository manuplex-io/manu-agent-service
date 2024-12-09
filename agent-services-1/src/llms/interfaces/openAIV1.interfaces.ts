// /src/llms/interfaces/llmV2.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';



export namespace OB1OpenAIV1 {



    export enum Models {
        GPT_4O_MINI = 'gpt-4o-mini',
        GPT_4O = 'gpt-4o',
    }


}
