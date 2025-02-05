// /src/llms/interfaces/llmV2.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export namespace OB1LLMV3Dto {
    export enum ProviderType {
        OPENAI = 'OpenAI',
        ANTHROPIC = 'Anthropic'
    }

    export class promptTracing {
        //traceId
        @IsString()
        traceId: string

        //parentSpanId
        @IsOptional()
        parentSpanId?: string;

        //spanId
        @IsOptional()
        spanId?: string;

        //spanName
        @IsOptional()
        spanName?: string;
    }
    
    export class LLMConfigDto {
        @IsOptional()
        parallelToolCalls?: any;

        @IsOptional()
        @IsString()
        model?: string;

        @IsOptional()
        @IsNumber()
        temperature?: number;

        @IsOptional()
        @IsNumber()
        maxCompletionTokens?: number;

        @IsOptional()
        @IsNumber()
        maxTokens?: number;
    }

    export class UserPromptDto {
        @IsOptional()
        @IsString()
        text: string;

        @IsOptional()
        @IsString()
        imageUrl?: string;

        @IsOptional()
        @IsString()
        imageDetail?: string;

        @IsOptional()
        @IsString()
        inputAudio?: string;

        @IsOptional()
        @IsString()
        inputAudioFormat?: string;

        @IsOptional()
        @IsString()
        data: string;
    }


    export class LLMRequestDto {
        @IsOptional()
        @IsString()
        systemPrompt: string;

        @IsNotEmpty()
        @ValidateNested({ each: true })
        @Type(() => UserPromptDto)
        userPrompt: UserPromptDto[] | string;

        @IsOptional()
        @IsArray()
        messages: Array<Record<string, any>>;

        @IsOptional()
        @Type(() => LLMConfigDto)
        config?: LLMConfigDto;

        @IsOptional()
        audio?: any;

        @IsOptional()
        responseFormat?: any;

        @IsOptional()
        toolChoice?: any;

        @IsOptional()
        @IsArray()
        tools?: Array<Record<string, any>>;
    }
    

    export class OB1GenericLLMRequestDto {
        @IsNotEmpty()
        @IsString()
        @IsEnum(OB1LLMV3Dto.ProviderType)
        provider: OB1LLMV3Dto.ProviderType;

        @IsNotEmpty()
        @IsObject()
        llmRequest: LLMRequestDto;

        @IsOptional()
        @IsObject()
        llmConfig?: LLMConfigDto;

        //trace dictionary 
        @IsOptional()
        @Type(() => promptTracing)
        tracing?: promptTracing;

        //metadata dictionary 
        @IsOptional()
        requestMetadata?: Record<string, any>;

        // @IsOptional()
        // @IsObject()
        // config?: Record<string, any>;
    }
}
