import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length } from 'class-validator';
import { Type } from 'class-transformer';

export enum LLMProvider {
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai'
}

export enum AnthropicModels {
    CLAUDE_3_OPUS = 'claude-3-opus-20240229',
    CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
    CLAUDE_3_HAIKU = 'claude-3-haiku-20240307'
}

export enum OpenAIModels {
    GPT_4O_MINI = 'gpt-4o-mini',
    GPT_4O = 'gpt-4o',
}

export class LLMConfig {
    @IsEnum(LLMProvider)
    provider: LLMProvider;

    @IsString()
    @IsEnum({ ...AnthropicModels, ...OpenAIModels })
    model: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    temperature?: number = 0.7;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(4096)
    maxTokens?: number = 1000;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    topP?: number = 1;

    @IsOptional()
    @IsNumber()
    @Min(-2)
    @Max(2)
    frequencyPenalty?: number = 0;

    @IsOptional()
    @IsNumber()
    @Min(-2)
    @Max(2)
    presencePenalty?: number = 0;
}

export class Message {
    @IsEnum(['system', 'user', 'assistant'])
    role: 'system' | 'user' | 'assistant';

    @IsString()
    @Min(1)
    @Max(32768)
    content: string;

    @IsOptional()
    @IsDateString()
    timestamp?: Date;
}

export class LLMRequest {
    @IsOptional()
    @IsString()
    @Length(1, 4096)
    systemPrompt?: string;

    @IsString()
    @Length(1, 32768)
    userPrompt: string;

    @ValidateNested()
    @Type(() => LLMConfig)
    config: LLMConfig;

    @IsOptional()
    @IsUUID()
    conversationId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Message)
    messageHistory?: Message[];
}

export interface LLMResponse {
    content: string;
    model: string;
    provider: LLMProvider;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    conversationId?: string;
}
