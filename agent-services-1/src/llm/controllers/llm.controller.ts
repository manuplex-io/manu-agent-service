// src/llm/controllers/llm.controller.ts
import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { LLMService } from '../services/llm.service';
import { LLMRequest, LLMResponse } from '../interfaces/llm.interfaces';

@Controller('llm')
export class LLMController {
    constructor(private readonly llmService: LLMService) { }

    @Post('generate')
    async generateResponse(
        @Body(new ValidationPipe({ transform: true })) request: LLMRequest,
    ): Promise<LLMResponse> {
        return await this.llmService.generateResponse(request);
    }
}