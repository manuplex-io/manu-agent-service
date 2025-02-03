// src/prompts/prompt.module.ts
import { Global, Module } from '@nestjs/common';
import { PromptManagementV1Service } from './services/promptManagementV1.service';
import { PromptExecutionV1Service } from './services/promptExecutionV1.service';
import { PromptCategoryManagementV1Service } from './services/promptCategoryManagementV1.service';
import { PromptExecutionValidationV1Service } from './services/validation/promptExecutionValidationV1.service';
import { PromptWorkflowExecutionV1Service } from './services/execution/promptWorkflowExecutionV1.service';
import { PromptToolExecutionV1Service } from './services/execution/promptToolExecutionV1.service';
import { PromptActivityExecutionV1Service } from './services/execution/promptActivityExecutionV1.service';
import { PromptLogV1Service } from './services/log/promptLogV1.service';
@Global()
@Module({
    imports: [],
    controllers: [],
    providers: [
        PromptExecutionValidationV1Service,
        PromptWorkflowExecutionV1Service,
        PromptToolExecutionV1Service,
        PromptActivityExecutionV1Service,
        PromptManagementV1Service,
        PromptExecutionV1Service,
        PromptCategoryManagementV1Service,
        PromptLogV1Service
    ],
    exports: [
        PromptManagementV1Service,
        PromptExecutionValidationV1Service,
        PromptWorkflowExecutionV1Service,
        PromptToolExecutionV1Service,
        PromptActivityExecutionV1Service,
        PromptExecutionV1Service,
        PromptCategoryManagementV1Service,
        PromptLogV1Service
    ]
})
export class PromptModule { }
