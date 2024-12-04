// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { validate } from 'class-validator';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai'
import { OB1LLM } from '../interfaces/llmV2.interfaces';

import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

@Injectable()
export class LLMV2Service {

    private readonly logger = new Logger(LLMV2Service.name);
    private readonly anthropic: Anthropic;
    private readonly openai: OpenAI;
    private validationPipe = new ValidationPipe({ transform: true, whitelist: true }); // Instantiates ValidationPipe
    constructor(
    ) {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: PORTKEY_GATEWAY_URL,
            defaultHeaders: createHeaders({
                provider: "openai",
                apiKey: process.env.PORTKEY_API_KEY // uses environment variable for Portkey API key
            })
        });
    }

    private async validateRequest(request: OB1LLM.LLMRequest): Promise<void> {
        const errors = await validate(request);
        if (errors.length > 0) {
            const errorMessages = errors.map(error =>
                Object.values(error.constraints || {}).join(', ')
            );
            throw new BadRequestException(errorMessages);
        }

        // Additional custom validations
        if (request.messageHistory?.length > 10) {
            throw new BadRequestException('Message history cannot exceed 10 messages');
        }

        let totalLength = request.userPrompt.length;
        if (request.systemPrompt) {
            totalLength += request.systemPrompt.length;
        }
        if (request.messageHistory) {
            totalLength += request.messageHistory.reduce((sum, msg) => sum + msg.content.length, 0);
        }

        const maxLength = request.config.provider === OB1LLM.LLMProvider.ANTHROPIC ? 100000 : 32768;
        if (totalLength > maxLength) {
            throw new BadRequestException(`Total prompt length exceeds ${maxLength} characters`);
        }

        // Validate provider-specific configurations
        this.validateProviderConfig(request.config);
    }

    private validateProviderConfig(config: OB1LLM.LLMConfig): void {
        const isAnthropicModel = Object.values(OB1LLM.AnthropicModels).includes(config.model as OB1LLM.AnthropicModels);
        const isOpenAIModel = Object.values(OB1LLM.OpenAIModels).includes(config.model as OB1LLM.OpenAIModels);

        if (config.provider === OB1LLM.LLMProvider.ANTHROPIC && !isAnthropicModel) {
            throw new BadRequestException(`Invalid model ${config.model} for Anthropic provider`);
        }

        if (config.provider === OB1LLM.LLMProvider.OPENAI && !isOpenAIModel) {
            throw new BadRequestException(`Invalid model ${config.model} for OpenAI provider`);
        }
    }

    private constructMessages(request: OB1LLM.LLMRequest): OB1LLM.Message[] {
        const messages: OB1LLM.Message[] = [];

        if (request.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.systemPrompt,
                timestamp: new Date(),
            });
        }

        if (request.messageHistory?.length) {
            messages.push(...request.messageHistory);
        }

        messages.push({
            role: 'user',
            content: request.userPrompt,
            timestamp: new Date(),
        });

        return messages;
    }

    private tryParseJSON(content: string): any {
        try {
            // Attempt to parse the string
            return JSON.parse(content);
        } catch (error) {
            // Return the original content if parsing fails
            return content;
        }
    }

    // private async callOpenAI(request: OB1LLM.LLMRequest, messages: OB1LLM.Message[]): Promise<OB1LLM.LLMResponse> {
    //     const reqHeaders = { headers: createHeaders({ "traceID": `LLM-TRACE-${Date.now()}` }) }
    //     const response = await this.openai.chat.completions.create({
    //         model: request.config.model,
    //         messages: messages.map(msg => ({
    //             role: msg.role,
    //             content: msg.content,
    //         })),
    //         temperature: request.config.temperature,
    //         max_tokens: request.config.maxTokens,
    //         top_p: request.config.topP,
    //         frequency_penalty: request.config.frequencyPenalty,
    //         presence_penalty: request.config.presencePenalty,
    //     }
    //         , reqHeaders);

    //     return {
    //         content: response.choices[0].message.content || '',
    //         model: response.model,
    //         provider: OB1LLM.LLMProvider.OPENAI,
    //         usage: {
    //             promptTokens: response.usage.prompt_tokens,
    //             completionTokens: response.usage.completion_tokens,
    //             totalTokens: response.usage.total_tokens,
    //         },
    //         conversationId: request.conversationId,
    //     };
    // }

    private async callOpenAIWithStructuredOutputNoTools(request: OB1LLM.LLMRequest, messages: OB1LLM.Message[]): Promise<OB1LLM.LLMResponse> {
        this.logger.debug(`Calling OpenAI with structured output:\n${JSON.stringify(request, null, 2)}`);
        const reqHeaders = {
            headers: createHeaders({
                "traceID": request.tracing.traceId || `AGENT-TRACE-${Date.now()}`,
                ...request.tracing.parentSpanId && { "parentSpanID": request.tracing.parentSpanId },
                ...request.tracing.spanId && { "spanID": request.tracing.spanId },
                ...request.tracing.spanName && { "spanName": request.tracing.spanName },
                "metadata": { ...(request.requestMetadata ?? { "_user": "NOT DEFINED" }) }
            })

        }

        const response = await this.openai.chat.completions.create({
            model: request.config.model,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: request.config.temperature,
            max_tokens: request.config.maxTokens,
            top_p: request.config.topP,
            frequency_penalty: request.config.frequencyPenalty,
            presence_penalty: request.config.presencePenalty,
            ...request.response_format && { response_format: request.response_format },
            //response_format: request.response_format,
        },
            reqHeaders);


        return {
            content: this.tryParseJSON(response.choices[0].message.content || ''),
            model: response.model,
            provider: OB1LLM.LLMProvider.OPENAI,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            conversationId: request.conversationId,
        };
    }

    private async callOpenAIWithStructuredOutputWithTools(request: OB1LLM.LLMRequest, messages: OB1LLM.Message[]): Promise<OB1LLM.LLMResponse> {

        const reqHeaders = {
            headers: createHeaders({
                "traceID": request.tracing.traceId || `AGENT-TRACE-${Date.now()}`,
                ...request.tracing.parentSpanId && { "parentSpanID": request.tracing.parentSpanId },
                ...request.tracing.spanId && { "spanID": request.tracing.spanId },
                ...request.tracing.spanName && { "spanName": request.tracing.spanName },
                "metadata": { ...(request.requestMetadata ?? { "_user": "NOT DEFINED" }) }
            })

        }

        const inputTools = request.inputTools.map(tool => ({
            function: {
                name: tool.toolName,
                description: tool.toolDescription,
                parameters: tool.toolInputSchema,
                strict: true,
            },
            type: "function" as const // explicitly set type as a literal
        }));

        const response = await this.openai.chat.completions.create({
            model: request.config.model,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: request.config.temperature,
            max_tokens: request.config.maxTokens,
            top_p: request.config.topP,
            frequency_penalty: request.config.frequencyPenalty,
            presence_penalty: request.config.presencePenalty,
            ...request.response_format && { response_format: request.response_format },
            //response_format: request.response_format,
            tool_choice: request.tool_choice || 'auto',
            tools: inputTools,
        },
            reqHeaders);


        return {
            content: this.tryParseJSON(response.choices[0].message.content || ''),
            model: response.model,
            provider: OB1LLM.LLMProvider.OPENAI,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            conversationId: request.conversationId,
        };
    }

    async generateResponseWithStructuredOutputNoTools(request: OB1LLM.LLMRequest): Promise<OB1LLM.LLMResponse> {
        // Validate functionInput as OB1LLM.LLMRequest V1
        try {
            request = await this.validationPipe.transform(request, { metatype: OB1LLM.LLMRequest, type: 'body' });
        } catch (validationError) {
            this.logger.error(`Validation failed for functionInput: ${validationError.message}`, validationError.stack);
            throw new BadRequestException('Invalid functionInput format');
        }
        try {
            await this.validateRequest(request);
            const messages = this.constructMessages(request);

            this.logger.debug(`Sending request to ${request.config.provider} with config:`, request.config);

            switch (request.config.provider) {
                // case OB1LLM.LLMProvider.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case OB1LLM.LLMProvider.OPENAI:
                    return await this.callOpenAIWithStructuredOutputNoTools(request, messages);
                default:
                    throw new BadRequestException(`Unsupported provider: ${request.config.provider}`);
            }
        } catch (error) {
            this.logger.error(`Error generating LLM response: ${error.message}`, error.stack);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }

    async generateResponseWithStructuredOutputWithTools(request: OB1LLM.LLMRequest): Promise<OB1LLM.LLMResponse> {
        // Validate functionInput as OB1LLM.LLMRequest V1
        try {
            request = await this.validationPipe.transform(request, { metatype: OB1LLM.LLMRequest, type: 'body' });
        } catch (validationError) {
            this.logger.error(`Validation failed for functionInput: ${validationError.message}`, validationError.stack);
            throw new BadRequestException('Invalid functionInput format');
        }
        try {
            await this.validateRequest(request);
            const messages = this.constructMessages(request);

            this.logger.debug(`Sending request to ${request.config.provider} with config:`, request.config);

            switch (request.config.provider) {
                // case OB1LLM.LLMProvider.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case OB1LLM.LLMProvider.OPENAI:
                    return await this.callOpenAIWithStructuredOutputWithTools(request, messages);
                default:
                    throw new BadRequestException(`Unsupported provider: ${request.config.provider}`);
            }
        } catch (error) {
            this.logger.error(`Error generating LLM response: ${error.message}`, error.stack);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }
}

// async generateResponseWithTools(
//     request: OB1LLM.LLMRequest,
// ): Promise<OB1LLM.LLMResponse> {
//     if (request.config.provider !== OB1LLM.LLMProvider.OPENAI) {
//         throw new BadRequestException('Tool integration is currently only supported with OpenAI');
//     }

//     try {
//         const messages = this.constructMessages(request);

//         const inputTools = request.inputTools.map(tool => ({
//             function: {
//                 name: tool.toolName,
//                 description: tool.toolDescription,
//                 parameters: tool.toolInputSchema,
//                 strict: true,
//             },
//             type: "function" as const // explicitly set type as a literal
//         }));



//         const reqHeaders = { headers: createHeaders({ "traceID": `AGENT-TRACE-${Date.now()}` }) }

//         // Initial completion with function definitions
//         const response = await this.openai.chat.completions.create({
//             model: request.config.model,
//             messages: messages,
//             tools: inputTools,
//             tool_choice: request.tool_choice || 'auto',
//             temperature: request.config.temperature,
//             max_tokens: request.config.maxTokens,
//             top_p: request.config.topP,
//             frequency_penalty: request.config.frequencyPenalty,
//             presence_penalty: request.config.presencePenalty,
//             response_format: request.response_format,
//         }, reqHeaders);

//         const Response = response.choices[0].message;

//         // If no function was called, return the regular response
//         if (!Response.tool_calls) {
//             return {
//                 content: Response.content || '',
//                 model: response.model,
//                 provider: OB1LLM.LLMProvider.OPENAI,
//                 usage: {
//                     promptTokens: response.usage.prompt_tokens,
//                     completionTokens: response.usage.completion_tokens,
//                     totalTokens: response.usage.total_tokens,
//                 },
//                 conversationId: request.conversationId,
//             };
//         }

//         // Handle tool call
//         const toolCall = Response.tool_calls[0].function;
//         const tool = request.inputTools.find(t => t.toolName === toolCall.name);

//         if (!tool) {
//             throw new Error(`Tool not found: ${toolCall.name}`);
//         }

//         return {
//             reqHeaders,
//             content: Response.content || '',
//             model: response.model,
//             provider: OB1LLM.LLMProvider.OPENAI,
//             usage: {
//                 promptTokens: response.usage.prompt_tokens,
//                 completionTokens: response.usage.completion_tokens,
//                 totalTokens: response.usage.total_tokens,
//             },
//             conversationId: request.conversationId,
//             toolCalls: [{
//                 name: toolCall.name,
//                 arguments: JSON.parse(toolCall.arguments),
//                 output: null // The controller will fill this after executing the tool
//             }]
//         };
//     } catch (error) {
//         this.logger.error(`Error generating LLM response with tools: ${error.message}`, error.stack);
//         if (error instanceof BadRequestException) {
//             throw error;
//         }
//         throw new Error(`Failed to generate response with tools: ${error.message}`);
//     }
// }

// async generateFinalResponseWithToolResult(
//     request: OB1LLM.LLMRequest,
//     tools: Tool[],
//     toolCall: ToolCallResult,
//     reqHeaders: any
// ): Promise<OB1LLM.LLMResponse> {
//     const messages = this.constructMessages(request);

//     // Add the function call and result to the message history
//     messages.push({
//         role: 'assistant',
//         content: '',
//         toolCall: {
//             name: toolCall.name,
//             arguments: toolCall.arguments
//         }
//     });

//     messages.push({
//         role: 'system', // Assume the tool response is from the system
//         content: JSON.stringify(toolCall.output),
//         toolName: toolCall.name
//     });



//     // Convert tools to OpenAI function format
//     const functions = tools.map(tool => ({
//         name: tool.toolName,
//         description: tool.toolDescription,
//         parameters: tool.inputSchema,
//         // {
//         //     type: 'object',
//         //     properties: tool.inputSchema,
//         //     required: Object.keys(tool.inputSchema)
//         // }
//     }));



//     // const requestOptions = {
//     //     method: 'get',
//     //     // traceId: "1729",
//     //     // spanId: "11",
//     //     // spanName: "LLM Call"
//     // }

//     // Get final response with function results
//     const completion = await this.openai.chat.completions.create({
//         model: request.config.model,
//         messages: this.convertToOpenAIMessages(messages),
//         functions,
//         temperature: request.config.temperature,
//         max_tokens: request.config.maxTokens,
//         top_p: request.config.topP,
//         frequency_penalty: request.config.frequencyPenalty,
//         presence_penalty: request.config.presencePenalty,
//     }, reqHeaders);

//     return {
//         content: completion.choices[0].message.content || '',
//         model: completion.model,
//         provider: OB1LLM.LLMProvider.OPENAI,
//         usage: {
//             promptTokens: completion.usage.prompt_tokens,
//             completionTokens: completion.usage.completion_tokens,
//             totalTokens: completion.usage.total_tokens,
//         },
//         conversationId: request.conversationId,
//         toolCalls: [toolCall]
//     };
// }

// async generateWithTools(
//     request: OB1LLM.LLMRequest,
// ): Promise<OB1LLM.LLMResponse> {
//     // If no tools specified in config or non-OpenAI provider, use regular generation
//     if (!request.config.tools?.length || request.config.provider !== OB1LLM.LLMProvider.OPENAI) {
//         return this.generateResponse(request);
//     }

//     try {
//         // Fetch tool information
//         const toolsInfo = await this.toolsRepo.find({
//             where: request.config.tools.map(toolId => ({ toolId })),
//             select: [
//                 'toolId',
//                 'toolName',
//                 'toolDescription',
//                 'inputSchema',
//                 'outputSchema',
//                 'toolStatus',
//             ]
//         });

//         // Validate that all requested tools were found
//         if (toolsInfo.length !== request.config.tools.length) {
//             const foundToolIds = toolsInfo.map(tool => tool.toolId);
//             const missingTools = request.config.tools.filter(id => !foundToolIds.includes(id));
//             throw new NotFoundException(`Tools not found: ${missingTools.join(', ')}`);
//         }

//         // Validate tool status
//         const unavailableTools = toolsInfo.filter(tool => tool.toolStatus !== 'active');
//         if (unavailableTools.length > 0) {
//             throw new BadRequestException(
//                 `Following tools are not available: ${unavailableTools.map(t => t.toolName).join(', ')}`
//             );
//         }

//         // Get initial response with potential tool calls
//         const response = await this.generateResponseWithTools(request, toolsInfo);

//         // If no tool was called, return the response as is
//         if (!response.toolCalls?.length) {
//             return response;
//         }

//         // Execute the tool call
//         const toolCall = response.toolCalls[0];
//         const tool = toolsInfo.find(t => t.toolName === toolCall.name);

//         if (!tool) {
//             throw new NotFoundException(`Tool not found: ${toolCall.name}`);
//         }

//         const reqHeaders = response.reqHeaders;

//         try {
//             // Execute the tool
//             const toolResult = await this.pythonLambdaService.invokeLambda(
//                 tool.toolId,
//                 toolCall.arguments
//             );

//             // Get final response incorporating the tool result
//             return await this.generateFinalResponseWithToolResult(
//                 request,
//                 toolsInfo,
//                 {
//                     ...toolCall,
//                     output: toolResult
//                 },
//                 reqHeaders
//             );
//         } catch (error) {
//             // Handle tool execution errors
//             this.logger.error(`Tool execution failed: ${error.message}`, error.stack);
//             throw new BadRequestException(`Tool execution failed: ${error.message}`);
//         }
//     } catch (error) {
//         // Rethrow validation and not found errors
//         if (error instanceof BadRequestException || error instanceof NotFoundException) {
//             throw error;
//         }
//         // Log and wrap other errors
//         this.logger.error(`Error in generate-with-tools: ${error.message}`, error.stack);
//         throw new BadRequestException(`Failed to process request: ${error.message}`);
//     }
// }
