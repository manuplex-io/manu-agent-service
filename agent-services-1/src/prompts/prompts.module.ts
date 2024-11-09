// src/prompts/prompt.module.ts
import { Global, Module } from '@nestjs/common';
import { PromptController } from './controllers/prompt.controller';
import { PromptService } from './services/prompt.service';
import { LLMModule } from '../llms/llms.module';
import { PythonLambdaService } from '../tools/services/python-lambda.service';
@Global()
@Module({
    imports: [
        LLMModule,
    ],
    controllers: [PromptController],
    providers: [PromptService, PythonLambdaService],
    exports: [PromptService]
})
export class PromptModule { }