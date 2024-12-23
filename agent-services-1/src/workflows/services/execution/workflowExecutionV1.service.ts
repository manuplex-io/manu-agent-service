// /src/workflows/services/workflowTestingV1.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { WorkflowExecutionTypeScriptV1Service } from './workflowExecutionLang/workflowExecutionTypeScriptV1.service';
import { WorkflowLoadingV1Service } from '../workflowLoadingV1.service';
import { OB1Workflow } from '../../interfaces/workflow.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentWorkflows } from '../../entities/ob1-agent-workflows.entity';

@Injectable()
export class WorkflowExecutionV1Service {
    constructor(
        private readonly workflowExecutionTypeScriptV1Service: WorkflowExecutionTypeScriptV1Service,
        @InjectRepository(OB1AgentWorkflows) private readonly workflowRepository: Repository<OB1AgentWorkflows>,
        private readonly workflowLoadingV1Service: WorkflowLoadingV1Service,
    ) { }



    /**
     * Execute any workflow based on its workflowLang using the workflowId.
     * @param workflowId the workflowId of the workflow to execute
     * @param workflowInputVariables the input object to execute the workflow with
     * @param workflowExecutionConfig the execution configuration for the workflow
     */
    async ExecuteAnyWorkflowWithWorkflowId(request: OB1Workflow.WorkflowExecuteRequest
    ): Promise<OB1Workflow.WorkflowExecutionResponse> {
        let workflow: OB1AgentWorkflows;

        try {
            workflow = await this.workflowRepository.findOne({ where: { workflowId: request.workflowId } });

            if (!workflow) {
                throw new BadRequestException({
                    message: `Workflow with ID ${request.workflowId} not found`,
                    code: 'WORKFLOW_NOT_FOUND',
                });
            }
        } catch (error) {
            throw new BadRequestException({
                message: 'Failed to fetch workflow',
                code: 'WORKFLOW_FETCH_FAILED',
                details: { error: error.message },
            });
        }

        const subServiceRequest: OB1Workflow.WorkflowSubServiceExecuteRequest = {
            workflow,
            ...request,
        }
        switch (request.workflowExecutionType) {
            case OB1Workflow.WorkflowExecutionType.SYNC:
                switch (workflow.workflowLang) {
                    case OB1Workflow.WorkflowLang.TYPESCRIPT:
                        return this.workflowExecutionTypeScriptV1Service.executeWorkflowSync(subServiceRequest);
        
                    default:
                        throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
                }
            case OB1Workflow.WorkflowExecutionType.ASYNC:
                switch (workflow.workflowLang) {
                    case OB1Workflow.WorkflowLang.TYPESCRIPT:
                        return this.workflowExecutionTypeScriptV1Service.executeWorkflowAsync(subServiceRequest);
        
                    default:
                        throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
                }
            case OB1Workflow.WorkflowExecutionType.SCHEDULED:
                switch (workflow.workflowLang) {
                    case OB1Workflow.WorkflowLang.TYPESCRIPT:
                        return this.workflowExecutionTypeScriptV1Service.executeWorkflowScheduled(subServiceRequest);
        
                    default:
                        throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
                }
            default:
                throw new BadRequestException(`Unsupported workflowExecutionType: ${request.workflowExecutionType}`);
        }
    }

    async getWorkflowExecutionStatus(temporalWorkflowId: string): Promise<OB1Workflow.WorkflowExecutionResponse> {
        return this.workflowExecutionTypeScriptV1Service.getWorkflowExecutionStatus(temporalWorkflowId);
    }

}