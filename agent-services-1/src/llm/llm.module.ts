// src/llm/llm.module.ts
import { Module } from '@nestjs/common';
import { LLMService } from './services/llm.service';
import { LLMController } from './controllers/llm.controller';

@Module({
    imports: [],
    controllers: [LLMController],
    providers: [LLMService],
    exports: [LLMService],
})
export class LLMModule { }