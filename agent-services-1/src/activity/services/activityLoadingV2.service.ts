// /src/activity/services/activityLoadingV2.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// import * as ts from 'typescript';

import { OB1AgentActivities } from '../entities/ob1-agent-activities.entity';
// import { RedisOb1Service } from '../../aa-common/redis-ob1/services/redis-ob1.service';

import { OB1Activity } from '../interfaces/activity.interface';
import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
import { OB1TSValidation } from '../../aa-common/ts-validation-ob1/interfaces/ts-validation-ob1.interface';

@Injectable()
export class ActivityLoadingV2Service {
    private readonly logger = new Logger(ActivityLoadingV2Service.name);
    private readonly REDIS_WORKFLOW_BASE_KEY = 'agentService:workerService:workflows';

    constructor(
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        // private readonly redisService: RedisOb1Service,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }
    // async loadAnyActivityToRedis(activityInput: OB1Activity.ActivityLoadingRequestV2): Promise<void> {
    //     try {
    //         const { workflowId, workflowExternalName, workflowActivityImportMap, workflowActivityCodeMap  } = activityInput;
    //         let isTTLUpdated = false;
    //         const redisActivityKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${workflowExternalName}:activityCode`;
    //         const redisImportKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${workflowExternalName}:imports`;

    //         const redisExistingActivityCode = await this.redisService.get(redisActivityKey);
    //         const redisExistingImports = await this.redisService.getSet(redisImportKey);

            
    //         if(redisExistingActivityCode && redisExistingImports){
    //             const ttlUpdateResult = await this.redisService.updateTTL([redisActivityKey, redisImportKey]);
    //             if(ttlUpdateResult){
    //                 isTTLUpdated = true;
    //             }
    //         }
    //         // return only if all ttl are updated, pulled out return statement for now.
    //         if(isTTLUpdated)
    //             return;

    //         const activityCode = workflowActivityCodeMap.get(workflowExternalName);
    //         const imports = workflowActivityImportMap.get(workflowExternalName);
    //         // More error handling needed
    //         const activityResult = await this.redisService.set(redisActivityKey, activityCode);
    //         const importResult = await this.redisService.set(redisImportKey, imports);

    //         return;
    //     } catch (error) {
    //         this.logger.log(`Failed to load activity:\n${JSON.stringify(error, null, 2)}`);
    //         throw new BadRequestException({
    //             message: 'Failed to load activity',
    //             errorSuperDetails: { ...error },
    //         });
    //     }
    // }

}