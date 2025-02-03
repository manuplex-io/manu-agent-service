import { Global, Module } from '@nestjs/common';

import { ActivityManagementV1Service } from './services/activityManagementV1.service';
import { ActivityTestingV1Service } from './services/activityTestingV1.service';
import { ActivityTypeScriptV1Service } from './services/activityLang/activityTypeScriptV1.service';
import { ActivityCategoryManagementV1Service } from './services/activityCategoryManagementV1.service';
import { ActivityLoadingV1Service } from './services/activityLoadingV1.service';
import { ActivityLoadingV2Service } from './services/activityLoadingV2.service';
@Global() // Makes this module globally accessible
@Module({
    imports: [

    ],
    providers: [
        ActivityManagementV1Service,
        ActivityTestingV1Service,
        ActivityCategoryManagementV1Service,
        ActivityLoadingV1Service,
        ActivityLoadingV2Service,
        //per activityLang
        ActivityTypeScriptV1Service, // Register TypeScript-specific validation
    ],
    exports: [
        ActivityManagementV1Service,
        ActivityTestingV1Service,
        ActivityCategoryManagementV1Service,
        ActivityLoadingV1Service,
        ActivityLoadingV2Service,
        //per activityLang
        ActivityTypeScriptV1Service,
    ],
})
export class ActivityModule { }
