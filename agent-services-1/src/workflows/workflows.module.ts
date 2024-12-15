import { Global, Module } from '@nestjs/common';

import { WorkflowManagementV1Service } from './services/workflowManagementV1.service';
import { WorkflowCategoryManagementV1Service } from './services/workflowCategoryManagementV1.service';

import { WorkflowTestingV1Service } from './services/testing/workflowTestingV1.service';
import { WorkflowTestingTypeScriptV1Service } from './services/testing/workflowTestingLang/workflowTestingTypeScriptV1.service';

import { WorkflowExecutionV1Service } from './services/execution/workflowExecutionV1.service';
import { WorkflowExecutionTypeScriptV1Service } from './services/execution/workflowExecutionLang/workflowExecutionTypeScriptV1.service';

import { WorkflowLoadingV1Service } from './services/workflowLoadingV1.service';

@Global() // Makes this module globally accessible
@Module({
    imports: [

    ],
    providers: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowExecutionV1Service,
        WorkflowCategoryManagementV1Service,
        WorkflowLoadingV1Service,

        //per workflowLang
        WorkflowTestingTypeScriptV1Service, // Register TypeScript-specific validation
        WorkflowExecutionTypeScriptV1Service, // Register TypeScript-specific execution
    ],
    exports: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowExecutionV1Service,
        WorkflowCategoryManagementV1Service,
        WorkflowLoadingV1Service,

        //per workflowLang
        WorkflowTestingTypeScriptV1Service,
        WorkflowExecutionTypeScriptV1Service,
    ],
})
export class WorkflowModule { }
