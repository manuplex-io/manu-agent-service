// src/llm/controllers/llm.controller.ts
import { Controller, Post, Body, ValidationPipe, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { LLMServiceV1 } from '../services/llmV1.service';
import { LLMV2Service } from '../services/llmV2.service';
import { LLMRequestV1, LLMResponseV1, LLMProviderV1 } from '../interfaces/llmV1.interfaces';
import { LLMRequest, LLMResponse, LLMProvider } from '../interfaces/llmV2.interfaces';

@Controller('llm')
export class LLMController {
    constructor(
        private readonly llmServiceV1: LLMServiceV1,
        private readonly llmV2Service: LLMV2Service,
    ) { }

    @Post('generateV1')
    async generateResponseV1(
        @Body(new ValidationPipe({ transform: true })) request: LLMRequestV1,
    ): Promise<LLMResponseV1> {
        return await this.llmServiceV1.generateResponseV1(request);
    }

    @Post('generateV2')
    async generateResponseV2(
        @Body(new ValidationPipe({ transform: true })) request: LLMRequest,
    ): Promise<LLMResponse> {
        return await this.llmV2Service.generateResponseWithStructuredOutputNoTools(request);
    }


}