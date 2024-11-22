// src/llm/llm.module.ts
import { Module, Global } from '@nestjs/common';
import { LLMServiceV1 } from './services/llmV1.service';
import { LLMV2Service } from './services/llmV2.service';
import { LLMController } from './controllers/llm.controller';

@Global()
@Module({
    imports: [
    ],
    controllers: [
        LLMController
    ],
    providers: [
        LLMServiceV1,
        LLMV2Service
    ],
    exports: [
        LLMServiceV1,
        LLMV2Service
    ],
})
export class LLMModule { }