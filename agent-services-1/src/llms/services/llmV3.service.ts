// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { OB1LLMV3Dto } from '../Dto/llmV3.Dto';
import { OB1OpenAIDto } from '../Dto/openAI.Dto';
import { OpenAIV1Service } from './openAI/openAIV1.service';

@Injectable()
export class LLMV3Service {

    private readonly logger = new Logger(LLMV3Service.name);
    private readonly anthropic: Anthropic;
    private readonly openai: OpenAI;
    private validationPipe = new ValidationPipe({ transform: true, whitelist: true }); // Instantiates ValidationPipe

    constructor(
        private openAIV1Service: OpenAIV1Service,
    ) { }

    async generateAnyLLMResponse(request: OB1LLMV3Dto.OB1GenericLLMRequestDto): Promise<any> {
        try {
            // LLM V3 Service will be used to generate responses for both OpenAI and Anthropic
            // It will have another switch statement to determine which provider to use and navigate to the appropriate service
            switch (request.provider) {
                case OB1LLMV3Dto.ProviderType.OPENAI:
                    // Place to build OPEN AI interface
                    // Validation for OpenAI request
                    const validatedInput = await this.validateInput(request, OB1OpenAIDto.OB1OpenAILLMRequestDto, OB1LLMV3Dto.ProviderType.OPENAI) as OB1OpenAIDto.OB1OpenAILLMRequestDto;
                    return await this.openAIV1Service.generateAnyResponse(validatedInput);
                default:
                    throw new BadRequestException(`Unsupported provider: ${request.provider}`);
            }
        } catch (error) {
            this.logger.error(`Error generating LLM response: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to generate LLM response',
                errorSuperDetails: { ...error },
            });
        }
    }

    private async validateInput(input: any, metatype: any, provider: OB1LLMV3Dto.ProviderType): Promise<any> {
        try {
            return await this.validationPipe.transform(input, { metatype, type: 'body' });
        } catch (error) {
            throw new BadRequestException({
                message: `Validation failed for ${provider}`,
                errorSuperDetails: { ...error },
            });
        }
    }
}