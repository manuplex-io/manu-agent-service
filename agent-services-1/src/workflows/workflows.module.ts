import { Global, Module } from '@nestjs/common';

import { WorkflowManagementV1Service } from './services/workflowManagementV1.service';
import { WorkflowTestingV1Service } from './services/workflowTestingV1.service';
import { WorkflowTypeScriptV1Service } from './services/workflowLang/workflowTypeScriptV1.service';
import { WorkflowCategoryManagementV1Service } from './services/workflowCategoryManagementV1.service';

@Global() // Makes this module globally accessible
@Module({
    imports: [

    ],
    providers: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowCategoryManagementV1Service,

        //per workflowLang
        WorkflowTypeScriptV1Service, // Register TypeScript-specific validation
    ],
    exports: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowCategoryManagementV1Service,

        //per workflowLang
        WorkflowTypeScriptV1Service,
    ],
})
export class WorkflowModule { }
