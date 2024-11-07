// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMConfig, LLMRequest, LLMResponse, Message, LLMProvider } from '../interfaces/llm.interfaces';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { validate } from 'class-validator';
import { AnthropicModels, OpenAIModels } from '../interfaces/llm.interfaces';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai'

@Injectable()
export class LLMService {
    private readonly logger = new Logger(LLMService.name);
    private readonly anthropic: Anthropic;
    private readonly openai: OpenAI;

    constructor() {
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

    private async validateRequest(request: LLMRequest): Promise<void> {
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

        const maxLength = request.config.provider === LLMProvider.ANTHROPIC ? 100000 : 32768;
        if (totalLength > maxLength) {
            throw new BadRequestException(`Total prompt length exceeds ${maxLength} characters`);
        }

        // Validate provider-specific configurations
        this.validateProviderConfig(request.config);
    }

    private validateProviderConfig(config: LLMConfig): void {
        const isAnthropicModel = Object.values(AnthropicModels).includes(config.model as AnthropicModels);
        const isOpenAIModel = Object.values(OpenAIModels).includes(config.model as OpenAIModels);

        if (config.provider === LLMProvider.ANTHROPIC && !isAnthropicModel) {
            throw new BadRequestException(`Invalid model ${config.model} for Anthropic provider`);
        }

        if (config.provider === LLMProvider.OPENAI && !isOpenAIModel) {
            throw new BadRequestException(`Invalid model ${config.model} for OpenAI provider`);
        }
    }

    private constructMessages(request: LLMRequest): Message[] {
        const messages: Message[] = [];

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

    // private async callAnthropic(request: LLMRequest, messages: Message[]): Promise<LLMResponse> {
    //     const response = await this.anthropic.messages.create({
    //         model: request.config.model,
    //         max_tokens: request.config.maxTokens,
    //         temperature: request.config.temperature,
    //         messages: messages.map(msg => ({
    //             role: msg.role,
    //             content: msg.content,
    //         })),
    //     });

    //     return {
    //         content: response.content[0].text,
    //         model: response.model,
    //         provider: LLMProvider.ANTHROPIC,
    //         usage: {
    //             promptTokens: response.usage.input_tokens,
    //             completionTokens: response.usage.output_tokens,
    //             totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    //         },
    //         conversationId: request.conversationId,
    //     };
    // }

    private async callOpenAI(request: LLMRequest, messages: Message[]): Promise<LLMResponse> {
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
            response_format: request.responseFormat
                ? request.responseFormat
                : { type: 'text' },
        });

        return {
            content: response.choices[0].message.content || '',
            model: response.model,
            provider: LLMProvider.OPENAI,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            conversationId: request.conversationId,
        };
    }

    async generateResponse(request: LLMRequest): Promise<LLMResponse> {
        try {
            await this.validateRequest(request);
            const messages = this.constructMessages(request);

            this.logger.debug(`Sending request to ${request.config.provider} with config:`, request.config);
            console.log("request",request)
            console.log("messages",messages)
            switch (request.config.provider) {
                // case LLMProvider.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case LLMProvider.OPENAI:
                    return await this.callOpenAI(request, messages);
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