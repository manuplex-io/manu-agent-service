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
    private validationPipe = new ValidationPipe({
        exceptionFactory: (errors) => {
            console.error('Validation Errors:', JSON.stringify(errors, null, 2)); // Pretty-print the full error object
            return new BadRequestException(errors);
        },
        whitelist: false, // Removes extra properties not in DTO
        transform: true, // Ensures incoming data is transformed to the correct types
    }); // Instantiates ValidationPipe
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
        // Validate request schema using class-validator
        const errors = await validate(request);
        if (errors.length > 0) {
            const errorMessages = errors.map(error =>
                Object.values(error.constraints || {}).join(', ')
            );
            throw new BadRequestException(errorMessages);
        }

        // Trim message history if it exceeds 15 entries
        if (request.messageHistory?.length > 15) {
            this.logger.warn('Trimming message history to the last 15 entries');
            request.messageHistory = request.messageHistory.slice(-15);
        }

        // Calculate total length using messageHistory
        const totalLength = request.messageHistory.reduce((sum, msg) => {
            return sum + (msg.content?.length || 0); // Safely handle undefined content
        }, 0);

        // Determine max length based on provider
        const maxLength = request.config.provider === OB1LLM.LLMProvider.OPENAI ? OB1LLM.MaxInputTokens.OPENAI : OB1LLM.MaxInputTokens.ANTHROPIC;
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

    private constructMessages(request: OB1LLM.LLMRequest): (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[] {
        const messages: (OB1LLM.NonToolMessage | OB1LLM.ChatCompletionToolMessageParam)[] = [];

        if (request.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.systemPrompt,
                //timestamp: new Date(),
            });
        }

        if (request.messageHistory?.length) {
            messages.push(...request.messageHistory);
        }

        // userPrompt will not be defined in the case of a tool call response
        if (request.userPrompt) {
            messages.push({
                role: 'user',
                content: request.userPrompt,
                //timestamp: new Date(),
            });
        }

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

    private async callOpenAIWithStructuredOutputNoTools(request: OB1LLM.LLMRequest): Promise<OB1LLM.LLMResponse> {
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
            messages: request.messageHistory,
            temperature: request.config.temperature,
            max_tokens: request.config.maxTokens,
            top_p: request.config.topP,
            frequency_penalty: request.config.frequencyPenalty,
            presence_penalty: request.config.presencePenalty,
            ...request.response_format && { response_format: request.response_format },
            //response_format: request.response_format,
        },
            reqHeaders);

        request.messageHistory.push({
            role: 'assistant',
            content: response.choices[0].message.content,
        });

        // If there are any tool calls, add them as well
        if (response.choices[0].message.tool_calls && Array.isArray(response.choices[0].message.tool_calls)) {
            for (const toolCall of response.choices[0].message.tool_calls) {
                request.messageHistory.push({
                    role: 'tool',
                    content: `tool name ${toolCall.function.name} called with arguments ${toolCall.function.arguments}`,
                    tool_call_id: toolCall.id,
                });
            }
        }


        return {
            content: this.tryParseJSON(response.choices[0].message.content || ''),
            messageHistory: request.messageHistory,
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

    private async callOpenAIWithStructuredOutputWithTools(
        request: OB1LLM.LLMRequest,
    ): Promise<OB1LLM.LLMResponse> {

        this.logger.log(`OpenAIRequest should have the message History: ${JSON.stringify(request, null, 2)}`);
        // Log each message as well-formatted JSON
        this.logger.log('Logging each message with the request:');
        request.messageHistory.forEach((msg, index) => {
            this.logger.log(`Message ${index + 1}: ${JSON.stringify(msg, null, 2)}`);
        });

        const reqHeaders = {
            headers: createHeaders({
                "traceID": request.tracing.traceId || `AGENT-TRACE-${Date.now()}`,
                ...request.tracing.parentSpanId && { "parentSpanID": request.tracing.parentSpanId },
                ...request.tracing.spanId && { "spanID": request.tracing.spanId },
                ...request.tracing.spanName && { "spanName": request.tracing.spanName },
                "metadata": { ...(request.requestMetadata ?? { "_user": "NOT DEFINED" }) }
            })

        }

        let inputTools = null;

        if (request.inputTools) {
            inputTools = request.inputTools.map(tool => {
                // Validate required fields for each tool
                if (!tool.toolExternalName || !tool.toolDescription || !tool.toolInputSchema) {
                    throw new Error(
                        `Invalid tool configuration: ${JSON.stringify(tool, null, 2)}`
                    );
                }

                // Map the tool to the required structure
                return {
                    function: {
                        name: tool.toolExternalName,
                        description: tool.toolDescription,
                        parameters: tool.toolInputSchema,
                        strict: true,
                    },
                    type: "function" as const // explicitly set type as a literal
                };
            });
        }

        const response = await this.openai.chat.completions.create({
            model: request.config.model,
            messages: request.messageHistory,
            temperature: request.config.temperature,
            max_tokens: request.config.maxTokens,
            top_p: request.config.topP,
            frequency_penalty: request.config.frequencyPenalty,
            presence_penalty: request.config.presencePenalty,
            ...request.response_format && { response_format: request.response_format },
            ...inputTools && {
                tools: inputTools,
                tool_choice: request.tool_choice || 'auto',
            },
        },
            reqHeaders);

        this.logger.log(`OpenAIResponse: ${JSON.stringify(response, null, 2)}`);

        // Handle assistant response
        // const assistantContent = response.choices[0].message.content ||
        //     (response.choices[0].message.tool_calls ? 'calling a tool' : 'No content provided');

        // request.messageHistory.push({
        //     role: 'assistant',
        //     content: assistantContent,
        // });

        // Remove duplicate tool calls from the response
        if (response.choices[0].message.tool_calls && Array.isArray(response.choices[0].message.tool_calls)) {
            // Deduplicate tool_calls based on tool name and arguments
            const uniqueToolCalls = [];
            const seenToolCalls = new Set();

            for (const toolCall of response.choices[0].message.tool_calls) {
                const uniqueKey = `${toolCall.function.name}:${toolCall.function.arguments}`;
                if (!seenToolCalls.has(uniqueKey)) {
                    seenToolCalls.add(uniqueKey);
                    uniqueToolCalls.push(toolCall);
                }
            }
            // Replace the original tool_calls with the deduplicated array
            response.choices[0].message.tool_calls = uniqueToolCalls;

            request.messageHistory = [
                ...request.messageHistory,
                response.choices[0].message,
            ];

            // request.messageHistory.push({
            //     role: 'assistant',
            //     content: response.choices[0].message.content,
            //     tool_calls: uniqueToolCalls,
            // });



            // tool_calls added as part of assistant message
            // // Add deduplicated tool calls to messageHistory
            // for (const toolCall of uniqueToolCalls) {
            //     request.messageHistory.push({
            //         role: 'tool',
            //         content: `tool name ${toolCall.function.name} called with arguments ${toolCall.function.arguments}`,
            //         tool_call_id: toolCall.id,
            //     });
            // }
        }

        // // If there are any tool calls, add them as well
        // if (response.choices[0].message.tool_calls && Array.isArray(response.choices[0].message.tool_calls)) {
        //     for (const toolCall of response.choices[0].message.tool_calls) {
        //         request.messageHistory.push({
        //             role: 'tool',
        //             content: `tool name ${toolCall.function.name} called with arguments ${toolCall.function.arguments}`,
        //             tool_call_id: toolCall.id,
        //         });
        //     }
        // }

        this.logger.log(`OpenAIResponse: ${JSON.stringify(request.messageHistory, null, 2)}`);


        return {
            content: this.tryParseJSON(response.choices[0].message.content || ''),
            messageHistory: request.messageHistory,
            tool_calls: response.choices[0].message.tool_calls,
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

            const messages = this.constructMessages(request); //also adds the messages to the messageHistory
            request.messageHistory = messages;  // message already contains messageHistory

            await this.validateRequest(request); // checks if max lenth is too long, also trims messageHistory

            this.logger.debug(`Sending request to ${request.config.provider} with config:`, request.config);

            switch (request.config.provider) {
                // case OB1LLM.LLMProvider.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case OB1LLM.LLMProvider.OPENAI:
                    return await this.callOpenAIWithStructuredOutputNoTools(request);
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
        // try {
        //     this.logger.log(`Request before validation: ${JSON.stringify(request, null, 2)}`);
        //     request = await this.validationPipe.transform(request, { metatype: OB1LLM.LLMRequest, type: 'body' });
        // } catch (validationError) {
        //     this.logger.error(`Validation failed for functionInput: ${validationError.message}`, validationError.stack);
        //     throw new BadRequestException('Invalid functionInput format');
        // }
        try {
            this.logger.log(`Request after validation but before validateRequest: ${JSON.stringify(request, null, 2)}`);
            const messages = this.constructMessages(request); //also adds the messages to the messageHistory
            // with new messages on top
            request.messageHistory = messages; // message now already contains messageHistory

            await this.validateRequest(request);
            this.logger.log(`Request after validateRequest: ${JSON.stringify(request, null, 2)}`);

            switch (request.config.provider) {
                // case OB1LLM.LLMProvider.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case OB1LLM.LLMProvider.OPENAI:
                    //this.logger.log(`Request after validation: ${JSON.stringify(request, null, 2)}`);
                    return await this.callOpenAIWithStructuredOutputWithTools(request);
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
