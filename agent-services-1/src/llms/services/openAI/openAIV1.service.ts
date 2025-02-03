// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { validate } from 'class-validator';
import { Repository, In } from 'typeorm';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai'

import { OB1OpenAIDto } from 'src/llms/Dto/openAI.Dto';
import { OB1OpenAIV1 } from 'src/llms/interfaces/openAIV1.interfaces';
import { OB1LLMV3 } from 'src/llms/interfaces/llmV3.interfaces';
import { OB1AgentRags } from 'src/rags/entities/ob1-agent-rags.entity';
import { RAGEmbeddingV1Service } from 'src/rags/services/ragEmbeddingV1.service';
import { RAGDataProcessingV1Service } from 'src/rags/services/ragDataProcessingV1.service';
import { InjectRepository } from '@nestjs/typeorm';
@Injectable()
export class OpenAIV1Service {
    private readonly logger = new Logger(OpenAIV1Service.name);
    private readonly openai: OpenAI;

    constructor(
        @InjectRepository(OB1AgentRags, 'vectorDb')
        private readonly ragDatasetRepository: Repository<OB1AgentRags>,    
        private readonly ragDataProcessingV1Service: RAGDataProcessingV1Service,
        private readonly ragEmbeddingV1Service: RAGEmbeddingV1Service
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: PORTKEY_GATEWAY_URL,
            defaultHeaders: createHeaders({
                provider: "openai",
                apiKey: process.env.PORTKEY_API_KEY
            })
        });
    }

    private async validateRequest(request: OB1OpenAIDto.OB1OpenAILLMRequestDto): Promise<void> {
        const errors = await validate(request);
        if (errors.length > 0) {
            const errorMessages = errors.map(error =>
                Object.values(error.constraints || {}).join(', ')
            );
            throw new BadRequestException({
                message: 'Open AI LLM Request Validation Failed',
                code: 'OPENAI_LLM_REQUEST_VALIDATION_FAILED'
            });
        }
    }

    private generateOpenAIMessages(request: OB1OpenAIDto.OB1OpenAILLMRequestDto): OB1OpenAIV1.ChatCompletionMessageParam[] {
        const messages: OB1OpenAIV1.ChatCompletionMessageParam[] = [];

        if (request.llmRequest.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.llmRequest.systemPrompt
            } as OB1OpenAIV1.ChatCompletionSystemMessage);
        }
        // Messages from dto converted to OpenAI messages
        if (request.llmRequest.messages?.length) {
            const convertedMessages = request.llmRequest.messages.map(msg => {
                const baseMessage = {
                    role: msg.role,
                    name: msg.name,
                    content: Array.isArray(msg.content) 
                        ? msg.content.map(part => ({
                            type: part.type,
                            text: part.text,
                            image_url: part.imageUrl ? {
                                url: part.imageUrl.url,
                                detail: part.imageUrl.detail
                            } : undefined,
                            input_audio: part.inputAudio ? {
                                data: part.inputAudio.data,
                                format: part.inputAudio.format
                            } : undefined
                        }))
                        : msg.content
                };

                switch (msg.role) {
                    case 'system':
                        return baseMessage as OB1OpenAIV1.ChatCompletionSystemMessage;
                    case 'user':
                        return baseMessage as OB1OpenAIV1.ChatCompletionUserMessage;
                    case 'assistant':
                        return {
                            ...baseMessage,
                            tool_call_id: msg.toolCallId,
                            function_call: msg.functionCall,
                            tool_calls: msg.toolCalls?.map(toolCall => ({
                                id: toolCall.id,
                                function: toolCall.function,
                                type: toolCall.type
                            }))
                        } as OB1OpenAIV1.ChatCompletionAssistantMessage;
                    case 'tool':
                        return {
                            ...baseMessage,
                            tool_call_id: msg.toolCallId
                        } as OB1OpenAIV1.ChatCompletionToolMessage;
                    case 'function':
                        return baseMessage as OB1OpenAIV1.ChatCompletionFunctionMessage;
                }
            });
            messages.push(...convertedMessages);
        }

        if (request.llmRequest.userPrompt) {
            if (Array.isArray(request.llmRequest.userPrompt)) {
                // Handle array of UserPromptDto
                const content = request.llmRequest.userPrompt.map(prompt => {
                    if (prompt.imageUrl) {
                        return {
                            type: 'image_url',
                            image_url: {
                                url: prompt.imageUrl,
                                detail: prompt.imageDetail || 'auto'
                            }
                        } as OB1OpenAIV1.ChatCompletionContentPartImage;
                    } else if (prompt.inputAudio) {
                        return {
                            type: 'input_audio',
                            input_audio: {
                                data: prompt.inputAudio,
                                format: prompt.inputAudioFormat as 'wav' | 'mp3'
                            }
                        } as OB1OpenAIV1.ChatCompletionContentPartInputAudio;
                    } else {
                        return {
                            type: 'text',
                            text: prompt.text
                        } as OB1OpenAIV1.ChatCompletionContentPartText;
                    }
                });
                messages.push({
                    role: 'user',
                    content: content
                } as OB1OpenAIV1.ChatCompletionUserMessage);
            } else {
                // Handle string userPrompt
                messages.push({
                    role: 'user',
                    content: request.llmRequest.userPrompt
                } as OB1OpenAIV1.ChatCompletionUserMessage);
            }
        }
        return messages;
    }

    private convertToOpenAIBody(request: OB1OpenAIDto.OB1OpenAILLMRequestDto): OB1OpenAIV1.OpenAILLMRequestBody {
        const messages = this.generateOpenAIMessages(request);        
        let responseFormat: OB1OpenAIV1.ResponseFormatText | OB1OpenAIV1.ResponseFormatJSONObject | OB1OpenAIV1.ResponseFormatJSONSchema | undefined;
        
        if (request.llmRequest.responseFormat) {
            if (request.llmRequest.responseFormat.type === 'text') {
                responseFormat = { type: 'text' };
            } else if (request.llmRequest.responseFormat.type === 'json_object') {
                responseFormat = { type: 'json_object' };
            } else if (request.llmRequest.responseFormat.type === 'json_schema' && request.llmRequest.responseFormat.jsonSchema) {
                responseFormat = {
                    type: 'json_schema',
                    json_schema: {
                        name: request.llmRequest.responseFormat.jsonSchema.name,
                        description: request.llmRequest.responseFormat.jsonSchema.description,
                        schema: request.llmRequest.responseFormat.jsonSchema.schema,
                        strict: request.llmRequest.responseFormat.jsonSchema.strict
                    }
                };
            }
        }

        return {
            messages,
            model: request.llmConfig?.model || OB1OpenAIDto.Models.GPT_4O_MINI,
            temperature: request.llmConfig?.temperature,
            max_tokens: request.llmConfig?.maxTokens,
            tools: request.llmRequest.tools,
            tool_choice: request.llmRequest.toolChoice,
            response_format: responseFormat,
            audio: request.llmRequest.audio,
            parallel_tool_calls: request.llmConfig?.parallelToolCalls,
            stream: request.llmRequest.stream
        };
    }

    async generateAnyResponse(request: OB1OpenAIDto.OB1OpenAILLMRequestDto): Promise<OB1LLMV3.ServiceResponse<any>> {
        try {
            await this.validateRequest(request);

            const openAIRequest = this.convertToOpenAIBody(request);
            
            const reqHeaders = {
                headers: createHeaders({
                    "traceID": request.tracing?.traceId || `AGENT-TRACE-${Date.now()}`,
                    ...request.tracing?.parentSpanId && { "parentSpanID": request.tracing.parentSpanId },
                    ...request.tracing?.spanId && { "spanID": request.tracing.spanId },
                    ...request.tracing?.spanName && { "spanName": request.tracing.spanName },
                    "metadata": { ...(request.requestMetadata ?? { "_user": "NOT DEFINED" }) }
                })
            };

            const response = await this.openai.chat.completions.create(
                openAIRequest,
                reqHeaders
            );

            return {
                success: true,
                data: {
                    ...response
                }
            };
        } catch (error) {
            this.logger.error(`Error generating OpenAI response: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to generate OpenAI response',
                errorSuperDetails: { ...error },
            });
        }
    }

    async generateAnyResponseWithRAG(request: OB1OpenAIDto.OB1OpenAILLMRequestDto): Promise<OB1LLMV3.ServiceResponse<any>> {
        try {
            await this.validateRequest(request);
            // Extract text prompt from request
            const textPrompt = typeof request.llmRequest.userPrompt === 'string' 
                ? request.llmRequest.userPrompt 
                : request.llmRequest.userPrompt?.[0]?.text;

            // Get embedding for the query
            const ragEmbedding = await this.ragEmbeddingV1Service.createOPENAIEmbeddingWithoutChunk(textPrompt);
            const embeddingVector = ragEmbedding.embedding;
            
            const items = await this.ragDatasetRepository
                .createQueryBuilder('item')
                .orderBy('embedding <-> :embedding::vector')
                .setParameter('embedding', `[${ragEmbedding.embedding.join(',')}]`)
                .limit(5)
                .getMany();
            // Prepare context from similar documents
            const contextString = items
                .map(ctx => ctx.content)
                .join('\n\n');

            // Modify the request to include context
            const openAIRequest = this.convertToOpenAIBody(request);
            
            // Insert context as system message at the beginning
            const contextMessage: OB1OpenAIV1.ChatCompletionSystemMessage = {
                role: 'system',
                content: `Context information:\n${contextString}\n\nUse the above context to help answer the following question.`
            };
            
            openAIRequest.messages.unshift(contextMessage);
            
            const reqHeaders = {
                headers: createHeaders({
                    "traceID": request.tracing?.traceId || `AGENT-TRACE-${Date.now()}`,
                    ...request.tracing?.parentSpanId && { "parentSpanID": request.tracing.parentSpanId },
                    ...request.tracing?.spanId && { "spanID": request.tracing.spanId },
                    ...request.tracing?.spanName && { "spanName": request.tracing.spanName },
                    "metadata": { ...(request.requestMetadata ?? { "_user": "NOT DEFINED" }) }
                })
            };

            const response = await this.openai.chat.completions.create(
                openAIRequest,
                reqHeaders
            );

            return {
                success: true,
                data: {
                    ...response,
                    relevantContexts: items.map(ctx => ({
                        content: ctx.content,
                        metadata: ctx.ragDataMetadata
                    }))
                }
            };
        } catch (error) {
            this.logger.error(`Error generating OpenAI response with RAG: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to generate OpenAI response with RAG',
                errorSuperDetails: { ...error },
            });
        }
    }
}

// usage: {
//     promptTokens: response.usage?.prompt_tokens || 0,
//     completionTokens: response.usage?.completion_tokens || 0,
//     totalTokens: response.usage?.total_tokens || 0
// }