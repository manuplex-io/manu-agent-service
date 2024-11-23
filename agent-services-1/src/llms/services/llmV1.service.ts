// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { validate } from 'class-validator';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai'
// import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { AnthropicModelsV1, OpenAIModelsV1, ToolV1 } from '../interfaces/llmV1.interfaces';
import { LLMConfigV1, LLMRequestV1, LLMResponseV1, MessageV1, ToolMessageV1, LLMProviderV1, OpenAIFunctionDefinitionV1, ToolCallResultV1 } from '../interfaces/llmV1.interfaces';



@Injectable()
export class LLMServiceV1 {

    private readonly logger = new Logger(LLMServiceV1.name);
    private readonly anthropic: Anthropic;
    private readonly openai: OpenAI;

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

    private async validateRequestV1(request: LLMRequestV1): Promise<void> {
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

        const maxLength = request.config.provider === LLMProviderV1.ANTHROPIC ? 100000 : 32768;
        if (totalLength > maxLength) {
            throw new BadRequestException(`Total prompt length exceeds ${maxLength} characters`);
        }

        // Validate provider-specific configurations
        this.validateProviderConfigV1(request.config);
    }

    private validateProviderConfigV1(config: LLMConfigV1): void {
        const isAnthropicModel = Object.values(AnthropicModelsV1).includes(config.model as AnthropicModelsV1);
        const isOpenAIModel = Object.values(OpenAIModelsV1).includes(config.model as OpenAIModelsV1);

        if (config.provider === LLMProviderV1.ANTHROPIC && !isAnthropicModel) {
            throw new BadRequestException(`Invalid model ${config.model} for Anthropic provider`);
        }

        if (config.provider === LLMProviderV1.OPENAI && !isOpenAIModel) {
            throw new BadRequestException(`Invalid model ${config.model} for OpenAI provider`);
        }
    }

    private constructMessagesV1(request: LLMRequestV1): MessageV1[] {
        const messages: MessageV1[] = [];

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
    // private async callAnthropic(request: LLMRequestV1, messages: Message[]): Promise<LLMResponseV1> {
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
    //         provider: LLMProviderV1.ANTHROPIC,
    //         usage: {
    //             promptTokens: response.usage.input_tokens,
    //             completionTokens: response.usage.output_tokens,
    //             totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    //         },
    //         conversationId: request.conversationId,
    //     };
    // }

    private async callOpenAIV1(request: LLMRequestV1, messages: MessageV1[]): Promise<LLMResponseV1> {
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
        });

        return {
            content: this.tryParseJSON(response.choices[0].message.content || ''),
            model: response.model,
            provider: LLMProviderV1.OPENAI,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            },
            conversationId: request.conversationId,
        };
    }

    async generateResponseV1(request: LLMRequestV1): Promise<LLMResponseV1> {
        try {
            await this.validateRequestV1(request);
            const messages = this.constructMessagesV1(request);

            this.logger.debug(`Sending request to ${request.config.provider} with config:`, request.config);

            switch (request.config.provider) {
                // case LLMProviderV1.ANTHROPIC:
                //     return await this.callAnthropic(request, messages);
                case LLMProviderV1.OPENAI:
                    return await this.callOpenAIV1(request, messages);
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

    // private convertToOpenAIMessagesV1(messages: ToolMessageV1[]): ChatCompletionMessageParam[] {
    //     return messages.map(msg => {
    //         switch (msg.role) {
    //             case 'system':
    //                 return {
    //                     role: 'system',
    //                     content: msg.content
    //                 };
    //             case 'user':
    //                 return {
    //                     role: 'user',
    //                     content: msg.content
    //                 };
    //             case 'assistant':
    //                 if (msg.toolCall) {
    //                     return {
    //                         role: 'assistant',
    //                         content: msg.content,
    //                         function_call: {
    //                             name: msg.toolCall.name,
    //                             arguments: JSON.stringify(msg.toolCall.arguments)
    //                         }
    //                     };
    //                 }
    //                 return {
    //                     role: 'assistant',
    //                     content: msg.content
    //                 };
    //             case 'tool':
    //                 return {
    //                     role: 'tool',
    //                     content: msg.content,
    //                     tool_call_id: `call_${msg.toolName}_${Date.now()}`, // Generate a unique ID
    //                     name: msg.toolName
    //                 };
    //             default:
    //                 throw new Error(`Unsupported message role: ${msg.role}`);
    //         }
    //     });
    // }




    // async generateResponseWithToolsV1(
    //     request: LLMRequestV1,
    //     tools: ToolV1[],
    // ): Promise<LLMResponseV1> {
    //     if (request.config.provider !== LLMProviderV1.OPENAI) {
    //         throw new BadRequestException('Tool integration is currently only supported with OpenAI');
    //     }

    //     try {
    //         const messages = this.constructMessagesV1(request);

    //         // Convert our tool definitions to OpenAI function format
    //         const functions: OpenAIFunctionDefinitionV1[] = tools.map(tool => ({
    //             name: tool.toolName,
    //             description: tool.toolDescription,
    //             parameters: tool.toolInputSchema,
    //             // strict: true,
    //             // {
    //             //     ...tool.inputSchema,
    //             //     // type: 'object',
    //             //     // properties: tool.inputSchema,
    //             //     // required: Object.keys(tool.inputSchema)
    //             // }
    //         }));

    //         const reqHeaders = { headers: createHeaders({ "traceID": `AGENT-TRACE-${Date.now()}` }) }

    //         // Initial completion with function definitions
    //         const response = await this.openai.chat.completions.create({
    //             model: request.config.model,
    //             messages: this.convertToOpenAIMessagesV1(messages),
    //             functions,
    //             function_call: 'auto',
    //             temperature: request.config.temperature,
    //             max_tokens: request.config.maxTokens,
    //             top_p: request.config.topP,
    //             frequency_penalty: request.config.frequencyPenalty,
    //             presence_penalty: request.config.presencePenalty,
    //         }, reqHeaders);

    //         const initialResponse = response.choices[0].message;

    //         // If no function was called, return the regular response
    //         if (!initialResponse.function_call) {
    //             return {
    //                 content: initialResponse.content || '',
    //                 model: response.model,
    //                 provider: LLMProviderV1.OPENAI,
    //                 usage: {
    //                     promptTokens: response.usage.prompt_tokens,
    //                     completionTokens: response.usage.completion_tokens,
    //                     totalTokens: response.usage.total_tokens,
    //                 },
    //                 conversationId: request.conversationId,
    //             };
    //         }

    //         // Handle function call
    //         const functionCall = initialResponse.function_call;
    //         const tool = tools.find(t => t.toolName === functionCall.name);

    //         if (!tool) {
    //             throw new Error(`Tool not found: ${functionCall.name}`);
    //         }

    //         return {
    //             reqHeaders,
    //             content: initialResponse.content || '',
    //             model: response.model,
    //             provider: LLMProviderV1.OPENAI,
    //             usage: {
    //                 promptTokens: response.usage.prompt_tokens,
    //                 completionTokens: response.usage.completion_tokens,
    //                 totalTokens: response.usage.total_tokens,
    //             },
    //             conversationId: request.conversationId,
    //             toolCalls: [{
    //                 name: functionCall.name,
    //                 arguments: JSON.parse(functionCall.arguments),
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

    // async generateFinalResponseWithToolResultV1(
    //     request: LLMRequestV1,
    //     tools: ToolV1[],
    //     toolCall: ToolCallResultV1,
    //     reqHeaders: any
    // ): Promise<LLMResponseV1> {
    //     const messages = this.constructMessagesV1(request);

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
    //         parameters: tool.toolInputSchema,
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
    //         messages: this.convertToOpenAIMessagesV1(messages),
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
    //         provider: LLMProviderV1.OPENAI,
    //         usage: {
    //             promptTokens: completion.usage.prompt_tokens,
    //             completionTokens: completion.usage.completion_tokens,
    //             totalTokens: completion.usage.total_tokens,
    //         },
    //         conversationId: request.conversationId,
    //         toolCalls: [toolCall]
    //     };
    // }

    // async generateWithToolsV1(
    //     request: LLMRequestV1,
    // ): Promise<LLMResponseV1> {
    //     // If no tools specified in config or non-OpenAI provider, use regular generation
    //     if (!request.config.tools?.length || request.config.provider !== LLMProviderV1.OPENAI) {
    //         return this.generateResponseV1(request);
    //     }

    //     try {
    //         // Fetch tool information
    //         const toolsInfo = await this.toolsRepo.find({
    //             where: request.config.tools.map(toolId => ({ toolId })),
    //             select: [
    //                 'toolId',
    //                 'toolName',
    //                 'toolDescription',
    //                 'toolInputSchema',
    //                 'toolOutputSchema',
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
    //         const response = await this.generateResponseWithToolsV1(request, toolsInfo);

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
    //             return await this.generateFinalResponseWithToolResultV1(
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
}