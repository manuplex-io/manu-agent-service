// src/llm/llm.module.ts
import { Module, Logger, Global } from '@nestjs/common';
import { WorkflowsController } from './controllers/workflows.controllers';
import { PythonLambdaService } from 'src/tools/services/python-lambda.service';
import { PromptService } from '../prompts/services/prompt.service';

@Global()
@Module({
    imports: [
    ],
    controllers: [
        WorkflowsController,
    ],
    providers: [
        Logger,
        PythonLambdaService,
        PromptService,
    ],
    exports: [

    ],
})
export class WORKFLOWSModule { }