// /src/llms/interfaces/llmV2.interfaces.ts
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray, ValidateNested, IsDateString, IsUUID, Length, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { OB1LLM } from '../interfaces/llmV2.interfaces';



export namespace OB1LLMDto {
    export class LLMRequest {
        @IsOptional()
        @IsString()
        @Length(1, 4096)
        systemPrompt?: string;

        @IsString()
        @Length(1, 32768)
        userPrompt: string;

        @ValidateNested()
        @Type(() => OB1LLM.LLMConfig)
        config: OB1LLM.LLMConfig;

        @IsOptional()
        @IsUUID()
        conversationId?: string;

        @IsOptional()
        @IsArray()
        @ValidateNested({ each: true })
        @Type(() => OB1LLM.Message)
        messageHistory?: OB1LLM.Message[];

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
        tool_choice?: OB1LLM.ChatCompletionToolChoiceOption;

        /**
         * A list of pre defined OB1 tools the model may call. Use this to provide a list of functions the model may generate JSON inputs
         * for. A max of 128 functions are supported.
         */
        @IsOptional()
        @IsArray()
        @ValidateNested({ each: true })
        @Type(() => OB1LLM.Tool)
        inputTools?: Array<OB1LLM.Tool>;

        //response_format
        @IsOptional()
        response_format?: OB1LLM.ResponseFormatJSONSchema;
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


        @IsOptional()
        @Type(() => OB1LLM.promptTracing)
        tracing?: OB1LLM.promptTracing;

        //metadata dictionary 
        @IsOptional()
        requestMetadata: Record<string, any>;

    }
}
