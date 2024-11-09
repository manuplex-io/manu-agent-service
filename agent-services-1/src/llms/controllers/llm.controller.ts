// src/llm/controllers/llm.controller.ts
import { Controller, Post, Body, ValidationPipe, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { LLMService } from '../services/llm.service';
import { LLMRequest, LLMResponse, LLMProvider } from '../interfaces/llm.interfaces';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentTools } from '../../tools/entities/ob1-agent-tools.entity';
import { PythonLambdaService } from '../../tools/services/python-lambda.service';

@Controller('llm')
export class LLMController {
    constructor(
        private readonly llmService: LLMService,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        private readonly pythonLambdaService: PythonLambdaService,
        private readonly logger: Logger
    ) { }

    @Post('generate')
    async generateResponse(
        @Body(new ValidationPipe({ transform: true })) request: LLMRequest,
    ): Promise<LLMResponse> {
        return await this.llmService.generateResponse(request);
    }

    // @Post('generate-with-tools')
    // async generateWithTools(
    //     @Body(new ValidationPipe({ transform: true })) request: LLMRequest,
    // ): Promise<LLMResponse> {
    //     // If no tools specified in config or non-OpenAI provider, use regular generation
    //     if (!request.config.tools?.length || request.config.provider !== LLMProvider.OPENAI) {
    //         return this.llmService.generateResponse(request);
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
    //         const response = await this.llmService.generateResponseWithTools(request, toolsInfo);

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
    //             return await this.llmService.generateFinalResponseWithToolResult(
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