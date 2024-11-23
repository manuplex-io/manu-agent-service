import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum LLMProviderV1 {
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai'
}

export enum AnthropicModelsV1 {
    CLAUDE_3_OPUS = 'claude-3-opus-20240229',
    CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
    CLAUDE_3_HAIKU = 'claude-3-haiku-20240307'
}

export enum OpenAIModelsV1 {
    GPT_4O_MINI = 'gpt-4o-mini',
    GPT_4O = 'gpt-4o',
}

export class ToolV1 {
    @IsString()
    toolId: string;

    @IsString()
    toolName: string;

    @IsString()
    toolDescription: string;

    @IsOptional()
    toolInputSchema: Record<string, any>;

    @IsOptional()
    toolOutputSchema: Record<string, any>;
}

export class LLMConfigV1 {
    @IsEnum(LLMProviderV1)
    provider: LLMProviderV1;

    @IsString()
    @IsEnum({ ...AnthropicModelsV1, ...OpenAIModelsV1 })
    model: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    temperature?: number = 0.7;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(16384)
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

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tools?: string[]; // Array of tool IDs to make available in the LLM
}
export class ToolCallV1 {
    @IsString()
    name: string;

    @IsObject()
    arguments: Record<string, any>;
}
export class ToolCallResultV1 extends ToolCallV1 {
    @IsObject()
    output: any;
}

export class MessageV1 {
    @IsEnum(['system', 'user', 'assistant'])
    role: 'system' | 'user' | 'assistant';

    @IsString()
    @Min(1)
    @Max(32768)
    content: string;

    @IsOptional()
    @IsDateString()
    timestamp?: Date;

    @IsOptional()
    @ValidateNested()
    @Type(() => ToolCallV1)
    toolCall?: ToolCallV1;  // For messages that include tool calls

    @IsOptional()
    @IsString()
    toolName?: string;    // For tool response messages
}

export class ToolMessageV1 {
    @IsEnum(['system', 'user', 'assistant', 'tool'])
    role: 'system' | 'user' | 'assistant' | 'tool';

    @IsString()
    @Min(1)
    @Max(32768)
    content: string;

    @IsOptional()
    @IsDateString()
    timestamp?: Date;

    @IsOptional()
    @ValidateNested()
    @Type(() => ToolCallV1)
    toolCall?: ToolCallV1;  // For messages that include tool calls

    @IsOptional()
    @IsString()
    toolName?: string;    // For tool response messages
}


export class LLMRequestV1 {
    @IsOptional()
    @IsString()
    @Length(1, 4096)
    systemPrompt?: string;

    @IsString()
    @Length(1, 32768)
    userPrompt: string;

    @ValidateNested()
    @Type(() => LLMConfigV1)
    config: LLMConfigV1;

    @IsOptional()
    @IsUUID()
    conversationId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageV1)
    messageHistory?: MessageV1[];

    @IsOptional()
    reqHeaders?: any;
}

export interface LLMResponseV1 {
    content: string;
    model: string;
    provider: LLMProviderV1;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    conversationId?: string;
    toolCalls?: ToolCallResultV1[];
    reqHeaders?: any;
}

// New interfaces for tool functionality
export interface ToolDefinitionV1 {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}




export interface OpenAIFunctionDefinitionV1 {
    name: string;
    description: string;
    parameters: any;
    strict?: boolean;
}