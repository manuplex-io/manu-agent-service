// src/prompts/prompt.module.ts
import { Global, Module } from '@nestjs/common';
import { PromptManagementV1Service } from './services/promptManagementV1.service';
import { PromptExecutionV1Service } from './services/promptExecutionV1.service';

@Global()
@Module({
    imports: [],
    controllers: [],
    providers: [
        PromptManagementV1Service,
        PromptExecutionV1Service
    ],
    exports: [
        PromptManagementV1Service,
        PromptExecutionV1Service]
})
export class PromptModule { }