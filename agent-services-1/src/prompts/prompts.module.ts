// src/prompts/prompt.module.ts
import { Global, Module } from '@nestjs/common';
import { PromptController } from './controllers/prompt.controller';
import { PromptV1Service } from './services/promptV1.service';
import { LLMModule } from '../llms/llms.module';

@Global()
@Module({
    imports: [
        LLMModule,
    ],
    controllers: [PromptController],
    providers: [
        PromptV1Service
    ],
    exports: [PromptV1Service]
})
export class PromptModule { }