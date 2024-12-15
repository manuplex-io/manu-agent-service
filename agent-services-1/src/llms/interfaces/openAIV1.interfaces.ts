export namespace OB1OpenAIV1 {
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

    export interface ChatCompletionContentPartText {
        type: 'text';
        text: string;
    }

    export interface ChatCompletionContentPartImage {
        type: 'image_url';
        image_url: {
            url: string;
            detail?: 'auto' | 'low' | 'high';
        };
    }

    export interface ChatCompletionContentPartInputAudio {
        type: 'input_audio';
        input_audio: {
            data: string;
            format: 'wav' | 'mp3';
        };
    }

    export type ChatCompletionContentPart = 
        | ChatCompletionContentPartText 
        | ChatCompletionContentPartImage
        | ChatCompletionContentPartInputAudio;

    export interface ChatCompletionSystemMessage {
        role: 'system';
        content: string | Array<ChatCompletionContentPartText>;
        name?: string;
    }

    export interface ChatCompletionUserMessage {
        role: 'user';
        content: string | Array<ChatCompletionContentPart>;
        name?: string;
    }

    export interface ChatCompletionAssistantMessage {
        role: 'assistant';
        content: string | Array<ChatCompletionContentPartText> | null;
        name?: string;
        tool_call_id?: string;
        function_call?: {
            name: string;
            arguments: string;
        } | null;
        tool_calls?: Array<ChatCompletionMessageToolCall>;
    }

    export interface ChatCompletionToolMessage {
        role: 'tool';
        content: string | null;
        tool_call_id: string;
    }

    export interface ChatCompletionFunctionMessage {
        role: 'function';
        content: string | null;
        name: string;
    }

    export interface ChatCompletionMessageToolCall {
        id: string;
        function: {
            name: string;
            arguments: string;
        };
        type: 'function';
    }

    export type ChatCompletionMessageParam = 
        | ChatCompletionSystemMessage
        | ChatCompletionUserMessage
        | ChatCompletionAssistantMessage
        | ChatCompletionToolMessage
        | ChatCompletionFunctionMessage;

    export interface ChatCompletionAudioParam {
        format: 'wav' | 'mp3' | 'flac' | 'opus' | 'pcm16';
        voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
    }

    export interface FunctionDefinition {
        name: string;
        description?: string;
        parameters?: Record<string, any>;
    }

    export interface ChatCompletionTool {
        function: FunctionDefinition;
        type: 'function';
    }
    export interface ResponseFormatText {
        type: 'text';
    }

    export interface ResponseFormatJSONObject {
        type: 'json_object';
    }

    export interface ResponseFormatJSONSchema {
        type: 'json_schema';
        json_schema: {
            name: string;
            description?: string;
            schema?: Record<string, unknown>;
            strict?: boolean | null;
        };
    }

    export interface OpenAILLMRequestBody {
        messages: Array<ChatCompletionMessageParam>;
        model: string;
        audio?: ChatCompletionAudioParam;
        response_format?: ResponseFormatText | ResponseFormatJSONObject | ResponseFormatJSONSchema;
        tool_choice?: 'none' | 'auto' | 'required' | {
            type: 'function';
            function: {
                name: string;
            };
        };
        tools?: Array<ChatCompletionTool>;
        parallel_tool_calls?: boolean;
        temperature?: number;
        max_tokens?: number;
        stream?: false | null;
    }

    export interface PromptTracing {
        traceId: string;
        parentSpanId?: string;
        spanId?: string;
        spanName?: string;
    }

    export interface OB1OpenAILLMRequest {
        provider: ProviderType;
        llmRequest: OpenAILLMRequestBody;
        config?: Record<string, any>;
        tracing?: PromptTracing;
        requestMetadata?: Record<string, any>;
    }

    export interface ChatCompletionPredictionContent {
        content: string | Array<ChatCompletionContentPartText>;
        type: 'content';
    }

    export interface LLMResponse {
        content: string | Record<string, any>;
        messageHistory: Array<ChatCompletionMessageParam>;
        model: string;
        provider: ProviderType;
        usage: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
        conversationId?: string;
    }

    export enum MaxInputTokens {
        OPENAI = 32000,
        ANTHROPIC = 100000
    }
}
