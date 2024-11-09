// src/llm/llm.module.ts
import { Module, Logger, Global } from '@nestjs/common';
import { LLMService } from './services/llm.service';
import { LLMController } from './controllers/llm.controller';
import { PythonLambdaService } from '../tools/services/python-lambda.service';

@Global()
@Module({
    imports: [
    ],
    controllers: [LLMController],
    providers: [LLMService, PythonLambdaService, Logger],
    exports: [LLMService],
})
export class LLMModule { }