// src/llm/llm.module.ts
import { Module, Global } from '@nestjs/common';
import { LLMServiceV1 } from './services/llmV1.service';
import { LLMV2Service } from './services/llmV2.service';
import { LLMV3Service } from './services/llmV3.service';
import { OpenAIV1Service } from './services/openAI/openAIV1.service';
@Global()
@Module({
    imports: [],
    controllers: [],
    providers: [
        LLMServiceV1,
        LLMV2Service,
        LLMV3Service,
        OpenAIV1Service
    ],
    exports: [
        LLMServiceV1,
        LLMV2Service,
        LLMV3Service,
        OpenAIV1Service
    ],
})
export class LLMModule { }