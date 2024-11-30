import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsDateString,
  IsUUID,
  Length,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { REPLCommand } from 'repl';

export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
}

export enum AnthropicModels {
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
}

export enum OpenAIModels {
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4O = 'gpt-4o',
}

export class Tool {
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[]; // Array of tool IDs to make available in the LLM
}
export class ToolCall {
  @IsString()
  name: string;

  @IsObject()
  arguments: Record<string, any>;
}
export class ToolCallResult extends ToolCall {
  @IsObject()
  output: any;
}

export class Message {
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @Length(1, 32768)
  content: string;

  @IsOptional()
  @IsDateString()
  timestamp?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToolCall)
  toolCall?: ToolCall; // For messages that include tool calls

  @IsOptional()
  @IsString()
  toolName?: string; // For tool response messages
}

export class ToolMessage {
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
  @Type(() => ToolCall)
  toolCall?: ToolCall; // For messages that include tool calls

  @IsOptional()
  @IsString()
  toolName?: string; // For tool response messages
}
//create new class for tracing
export class promptTracing {
  //traceId
  @IsString()
  @IsOptional()
  traceId: string;

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

//create new class for metadata
export class RequestMetadata {
  //user_id
  personId?: string;

  //user_role
  userRole?: string;

  //userOrgId
  userOrgId?: string;

  //sourceFunction
  sourceFunction?: string;

  //ENV
  ENV?: string;

  //reuestingService
  sourceService?: string;

  //requestId
  requestId?: string;
}

export class LLMRequest {
  @IsOptional()
  @IsString()
  @Length(1, 8192)
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

  @IsOptional()
  reqHeaders?: any;

  /**
   * Controls which (if any) tool is called by the model. `none` means the model will
   * not call any tool and instead generates a message. `auto` means the model can
   * pick between generating a message or calling one or more tools. `required` means
   * the model must call one or more tools. Specifying a particular tool via
   * `{"type": "function", "function": {"name": "my_function"}}` forces the model to
   * call that tool.
   *
   * `none` is the default when no tools are present. `auto` is the default if tools
   * are present.
   */
  tool_choice?: ChatCompletionToolChoiceOption;

  /**
   * A list of pre defined OB1 tools the model may call. Use this to provide a list of functions the model may generate JSON inputs
   * for. A max of 128 functions are supported.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Tool)
  inputTools?: Array<Tool>;

  //response_format
  @IsOptional()
  response_format?: ResponseFormatJSONSchema;
  //e.g
  // response_format: {
  // "type": "json_schema",
  //     "json_schema": {
  //     "name": "standard_response_format",
  //         "description": "standard format so output can be formatted consistently",
  //             "schema": {
  //         "content": {
  //             "type": "string"
  //         }
  //     },
  //     strict: true
  // }
  // },

  //trace dictionary
  @ValidateNested()
  @Type(() => promptTracing)
  tracing: promptTracing;

  //metadata dictionary
  @IsOptional()
  @ValidateNested()
  @Type(() => RequestMetadata)
  requestMetadata?: RequestMetadata;
}

/**
 * Controls which (if any) tool is called by the model. `none` means the model will
 * not call any tool and instead generates a message. `auto` means the model can
 * pick between generating a message or calling one or more tools. `required` means
 * the model must call one or more tools. Specifying a particular tool via
 * `{"type": "function", "function": {"name": "my_function"}}` forces the model to
 * call that tool.
 *
 * `none` is the default when no tools are present. `auto` is the default if tools
 * are present.
 */
export type ChatCompletionToolChoiceOption =
  | 'none'
  | 'auto'
  | 'required'
  | ChatCompletionNamedToolChoice;

/**
 * Specifies a tool the model should use. Use to force the model to call a specific
 * function.
 */
export interface ChatCompletionNamedToolChoice {
  function: ChatCompletionNamedToolChoice.Function;

  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: 'function';
}

export namespace ChatCompletionNamedToolChoice {
  export interface Function {
    /**
     * The name of the function to call.
     */
    name: string;
  }
}

export interface ChatCompletionTool {
  function: FunctionDefinition;

  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: 'function';
}

export interface FunctionDefinition {
  /**
   * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
   * underscores and dashes, with a maximum length of 64.
   */
  name: string;

  /**
   * A description of what the function does, used by the model to choose when and
   * how to call the function.
   */
  description?: string;

  /**
   * The parameters the functions accepts, described as a JSON Schema object. See the
   * [guide](https://platform.openai.com/docs/guides/function-calling) for examples,
   * and the
   * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
   * documentation about the format.
   *
   * Omitting `parameters` defines a function with an empty parameter list.
   */
  parameters?: FunctionParameters;

  /**
   * Whether to enable strict schema adherence when generating the function call. If
   * set to true, the model will follow the exact schema defined in the `parameters`
   * field. Only a subset of JSON Schema is supported when `strict` is `true`. Learn
   * more about Structured Outputs in the
   * [function calling guide](docs/guides/function-calling).
   */
  strict?: boolean | null;
}

/**
 * The parameters the functions accepts, described as a JSON Schema object. See the
 * [guide](https://platform.openai.com/docs/guides/function-calling) for examples,
 * and the
 * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
 * documentation about the format.
 *
 * Omitting `parameters` defines a function with an empty parameter list.
 */
export type FunctionParameters = Record<string, unknown>;

export interface ResponseFormatJSONSchema {
  json_schema: ResponseFormatJSONSchema.JSONSchema;

  /**
   * The type of response format being defined: `json_schema`
   */
  type: 'json_schema';
}

export namespace ResponseFormatJSONSchema {
  export interface JSONSchema {
    /**
     * The name of the response format. Must be a-z, A-Z, 0-9, or contain underscores
     * and dashes, with a maximum length of 64.
     */
    name: string;

    /**
     * A description of what the response format is for, used by the model to determine
     * how to respond in the format.
     */
    description?: string;

    /**
     * The schema for the response format, described as a JSON Schema object.
     */
    schema?: Record<string, unknown>;

    /**
     * Whether to enable strict schema adherence when generating the output. If set to
     * true, the model will always follow the exact schema defined in the `schema`
     * field. Only a subset of JSON Schema is supported when `strict` is `true`. To
     * learn more, read the
     * [Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).
     */
    strict?: boolean | null;
  }
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
  toolCalls?: ToolCallResult[];
  reqHeaders?: any;

  //custom error message
  // error: boolean;

  // errorMessage?: string;
  // errorCode?: number;
  // messageContent?: any
}
