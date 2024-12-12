// src/llm/llm.module.ts
import { Module, Logger, Global } from '@nestjs/common';

import { PythonLambdaV1Service } from 'src/tools/services/toolSpecificService/pythonLambdaV1.service';

import { WorkflowControllerV1 } from './controllers/workflowsV1.controllers';
import { WorkflowRepositoryServiceV1 } from './services/workflow/workflowRepositoryV1.service';

import { ActivityControllerV1 } from './controllers/activityV1.controller';
import { ActivityRepositoryServiceV1 } from './services/activity/activityRepositoryV1.service';
import { ActivityRunnerServiceV1 } from './services/activity/activityRunnerV1.service';

//old
import { TemporalWorkflowsController } from './controllers/temporal-workflows.controllers';
import { TemporalWorkflowsService } from './services/temporal-workflows.service';


@Global()
@Module({
    imports: [
    ],
    controllers: [
        WorkflowControllerV1,
        TemporalWorkflowsController,
        ActivityControllerV1,
    ],
    providers: [
        Logger,

        WorkflowRepositoryServiceV1,
        ActivityRepositoryServiceV1,
        ActivityRunnerServiceV1,

        PythonLambdaV1Service,
        TemporalWorkflowsService,

    ],
    exports: [


    ],
})
export class WORKFLOWSModule { }
