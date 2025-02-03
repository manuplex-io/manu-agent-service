import { Global, Module } from '@nestjs/common';

import { WorkflowManagementV1Service } from './services/workflowManagementV1.service';
import { WorkflowCategoryManagementV1Service } from './services/workflowCategoryManagementV1.service';

import { WorkflowTestingV1Service } from './services/testing/workflowTestingV1.service';
import { WorkflowTestingTypeScriptV1Service } from './services/testing/workflowTestingLang/workflowTestingTypeScriptV1.service';
import { WorkflowTestingTypeScriptV2Service } from './services/testing/workflowTestingLang/workflowTestingTypeScriptV2.service';

import { WorkflowExecutionV1Service } from './services/execution/workflowExecutionV1.service';
import { WorkflowExecutionV2Service } from './services/execution/workflowExecutionV2.service';

import { WorkflowExecutionTypeScriptV1Service } from './services/execution/workflowExecutionLang/workflowExecutionTypeScriptV1.service';
import { WorkflowExecutionTypeScriptV2Service } from './services/execution/workflowExecutionLang/workflowExecutionTypeScriptV2.service';

import { WorkflowLoadingV1Service } from './services/workflowLoadingV1.service';
import { WorkflowLoadingV2Service } from './services/workflowLoadingV2.service';
@Global() // Makes this module globally accessible
@Module({
    imports: [

    ],
    providers: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowExecutionV1Service,
        WorkflowExecutionV2Service,
        WorkflowCategoryManagementV1Service,
        WorkflowLoadingV1Service,
        WorkflowLoadingV2Service,
        //per workflowLang
        WorkflowTestingTypeScriptV1Service, 
        WorkflowTestingTypeScriptV2Service,
        WorkflowExecutionTypeScriptV1Service,
        WorkflowExecutionTypeScriptV2Service,
    ],
    exports: [
        WorkflowManagementV1Service,
        WorkflowTestingV1Service,
        WorkflowExecutionV1Service,
        WorkflowExecutionV2Service,
        WorkflowCategoryManagementV1Service,
        WorkflowLoadingV1Service,
        WorkflowLoadingV2Service,
        //per workflowLang
        WorkflowTestingTypeScriptV1Service,
        WorkflowTestingTypeScriptV2Service,
        WorkflowExecutionTypeScriptV1Service,
        WorkflowExecutionTypeScriptV2Service,
    ],
})
export class WorkflowModule { }
