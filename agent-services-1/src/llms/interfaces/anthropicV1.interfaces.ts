// /src/llms/interfaces/anthropicV1.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';



export namespace OB1AnthropicV1 {

    export enum Models {
        CLAUDE_3_OPUS = 'claude-3-opus-20240229',
        CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
        CLAUDE_3_HAIKU = 'claude-3-haiku-20240307'
    }

}
