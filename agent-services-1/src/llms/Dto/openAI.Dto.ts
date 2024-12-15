// /src/llms/interfaces/llmV2.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject, IsNotEmpty, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsBase64FileSize } from './FileSize.validator';

export namespace OB1OpenAIDto {
    export enum ProviderType {
        OPENAI = 'OpenAI'
    }

    export enum Models {
        GPT_4O_MINI = 'gpt-4o-mini',
        GPT_4O = 'gpt-4o',
        GPT_4 = 'gpt-4',
        GPT_4_TURBO = 'gpt-4-turbo-preview',
        GPT_35_TURBO = 'gpt-3.5-turbo'
    }

    export class ChatCompletionAudioParamDto {
        @IsEnum(['wav', 'mp3', 'flac', 'opus', 'pcm16'])
        format: 'wav' | 'mp3' | 'flac' | 'opus' | 'pcm16';
  
        @IsEnum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'])
        voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
    }

    export class promptTracing {
        @IsString()
        traceId: string

        @IsOptional()
        parentSpanId?: string;

        @IsOptional()
        spanId?: string;

        @IsOptional()
        spanName?: string;
    }

    export class ChatCompletionMessageToolCallDto {
        @IsString()
        id: string;

        @IsObject()
        function: {
            name: string;
            arguments: string;
        };

        @IsString()
        @IsEnum(['function'])
        type: 'function';
    }

    export class ImageURLDto {
        @IsString()
        @IsNotEmpty()
        url: string;

        @IsOptional()
        @IsEnum(['auto', 'low', 'high'])
        detail?: 'auto' | 'low' | 'high';
    }

    export class InputAudioDto {
        @IsString()
        @IsNotEmpty()
        data: string;

        @IsEnum(['wav', 'mp3'])
        format: 'wav' | 'mp3';
    }

    export class ChatCompletionContentPartDto {
        @IsString()
        @IsEnum(['text', 'image_url', 'input_audio'])
        type: 'text' | 'image_url' | 'input_audio';
      
        @IsOptional()
        @IsString()
        text?: string;
      
        @IsOptional()
        @Type(() => ImageURLDto)
        imageUrl?: ImageURLDto;
      
        @IsOptional()
        @Type(() => InputAudioDto)
        inputAudio?: InputAudioDto;
    }

    export class ChatCompletionMessageParamDto {
        @IsString()
        @IsEnum(['system', 'user', 'assistant', 'tool', 'function'])
        role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
      
        @IsNotEmpty()
        content: string | Array<ChatCompletionContentPartDto> | null;
      
        @IsOptional()
        @IsString()
        name?: string;
      
        @IsOptional()
        @IsString()
        toolCallId?: string;

        @IsOptional()
        functionCall?: {
            name: string;
            arguments: string;
        } | null;

        @IsOptional()
        toolCalls?: Array<ChatCompletionMessageToolCallDto>;
    }

    export class FunctionDefinitionDto {
        @IsString()
        @Length(1, 64)
        @IsNotEmpty()
        name: string;
    
        @IsOptional()
        @IsString()
        description?: string;
    
        @IsOptional()
        @IsObject()
        parameters?: Record<string, any>;
    }

    export class ChatCompletionToolDto {
        @ValidateNested()
        @Type(() => FunctionDefinitionDto)
        function: FunctionDefinitionDto;
    
        @IsString()
        @IsEnum(['function'])
        type: 'function';
    }

    export class ChatCompletionPredictionContentDto {
        @IsNotEmpty()
        content: string | Array<ChatCompletionContentPartDto>;

        @IsString()
        @IsEnum(['content'])
        type: 'content';
    }

    export class JSONSchemaDto {
        @IsString()
        @IsNotEmpty()
        name: string;

        @IsOptional()
        @IsString()
        description?: string;

        @IsOptional()
        @IsObject()
        schema?: Record<string, unknown>;

        @IsOptional()
        @IsBoolean()
        strict?: boolean | null;
    }

    export class ResponseFormatDto {
        @IsString()
        @IsEnum(['text', 'json_object', 'json_schema'])
        type: 'text' | 'json_object' | 'json_schema';

        @IsOptional()
        @ValidateNested()
        @Type(() => JSONSchemaDto)
        jsonSchema?: JSONSchemaDto;
    }

    export class UserPromptDto {
        @IsOptional()
        @IsString()
        @IsBase64FileSize(1 * 1024 * 1024, {
            message: 'File size must not exceed 100KB.',
            groups: ['userPromptDto']
        })
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
        text?: string;
    }
    
    export class OpenAILLMRequestDto {
        @IsNotEmpty()
        @IsString()
        systemPrompt: string;

        @IsNotEmpty()
        @Transform(({ value }) => {
            // If value is a string, convert it to UserPromptDto
            if (typeof value === 'string') {
                return [{text: value}];
            }
            return value;
        })
        @ValidateNested({ each: true })
        @Type(() => UserPromptDto)
        userPrompt: string | Array<UserPromptDto>;

        @IsOptional()
        @IsArray()
        messages: Array<ChatCompletionMessageParamDto>;

        @IsOptional()
        @Type(() => ChatCompletionAudioParamDto)
        audio?: ChatCompletionAudioParamDto;

        @IsOptional()
        @ValidateNested()
        @Type(() => ResponseFormatDto)
        responseFormat?: ResponseFormatDto;

        @IsOptional()
        toolChoice?: 'none' | 'auto' | 'required' | {
            type: 'function';
            function: {
                name: string;
            };
        };

        @IsOptional()
        @IsArray()
        @ValidateNested({ each: true })
        @Type(() => ChatCompletionToolDto)
        tools?: ChatCompletionToolDto[];

        @IsOptional()
        stream?: false | null;
    }

    export class OpenAIConfigDto {
        @IsOptional()
        @IsString()
        @IsEnum(Models)
        model?: Models = Models.GPT_4O_MINI;

        @IsOptional()
        @IsBoolean()
        parallelToolCalls?: boolean;

        @IsOptional()
        @IsNumber()
        @Min(0)
        @Max(2)
        temperature?: number = 0.7;

        @IsOptional()
        @IsNumber()
        maxTokens?: number = 1000;

        @IsOptional()
        @IsNumber()
        maxCompletionTokens?: number;
    }

    export class OB1OpenAILLMRequestDto {
        @IsNotEmpty()
        @IsString()
        @IsEnum(ProviderType)
        provider: ProviderType = ProviderType.OPENAI;

        @IsNotEmpty()
        @ValidateNested()
        @Type(() => OpenAILLMRequestDto)
        llmRequest: OpenAILLMRequestDto;

        @IsOptional()
        @Type(() => OpenAIConfigDto)
        llmConfig?: OpenAIConfigDto;

        @IsOptional()
        @Type(() => promptTracing)
        tracing?: promptTracing;

        @IsOptional()
        requestMetadata?: Record<string, any>;

        // @IsOptional()
        // @IsObject()
        // config?: Record<string, any>;
    }

}
