// /src/llms/interfaces/llmV2.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1AnthropicV1 } from './anthropicV1.interfaces';
import { OB1OpenAIV1 } from './openAIV1.interfaces';


export namespace OB1LLM {
    export enum LLMProvider {
        ANTHROPIC = 'anthropic',
        OPENAI = 'openai'
    }

}
