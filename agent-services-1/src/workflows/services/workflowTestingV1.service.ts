// /src/workflows/services/workflowTestingV1.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { WorkflowTypeScriptV1Service } from './workflowLang/workflowTypeScriptV1.service';
import { OB1Workflow } from '../interfaces/workflow.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentWorkflows } from '../entities/ob1-agent-workflows.entity';

@Injectable()
export class WorkflowTestingV1Service {
    constructor(
        private readonly workflowTypeScriptV1Service: WorkflowTypeScriptV1Service,
        @InjectRepository(OB1AgentWorkflows)
        private readonly workflowRepository: Repository<OB1AgentWorkflows>,
    ) { }

    /**
     * Validate any workflow based on its workflowLang.
     * @param workflow the full workflow object
     */
    async validateAnyWorkflow(workflow: OB1Workflow.CreateWorkflow): Promise<void> {
        switch (workflow.workflowLang) {
            case OB1Workflow.WorkflowLang.TYPESCRIPT:
                await this.workflowTypeScriptV1Service.validateWorkflow({
                    workflowCode: workflow.workflowCode,
                    workflowInputSchema: workflow.workflowInputSchema,
                    workflowOutputSchema: workflow.workflowOutputSchema,
                    workflowImports: workflow.workflowImports,
                    activitiesUsedByWorkflow: workflow.activitiesUsedByWorkflow,
                });
                break;
            default:
                throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
        }
    }

    /**
     * Test any workflow based on its workflowLang.
     * @param workflow the full workflow object
     * @param workflowInput the input object to test the workflow with
     */
    async testAnyWorkflow(
        workflow: OB1Workflow.CreateWorkflow,
        workflowInput: Record<string, any>,
    ): Promise<any> {
        switch (workflow.workflowLang) {
            case OB1Workflow.WorkflowLang.TYPESCRIPT:
                return this.workflowTypeScriptV1Service.testWorkflow(
                    {
                        workflowCode: workflow.workflowCode,
                        workflowInputSchema: workflow.workflowInputSchema,
                        workflowOutputSchema: workflow.workflowOutputSchema,
                        workflowImports: workflow.workflowImports,
                    },
                    workflowInput,
                );
            default:
                throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
        }
    }

    /**
     * Test any workflow based on its workflowLang using the workflowId.
     * @param id the workflowId of the workflow to test
     * @param workflowInput the input object to test the workflow with
     */
    async testAnyWorkflowWithWorkflowId(
        id: string,
        workflowInput: Record<string, any>,
    ): Promise<any> {
        let workflow: OB1AgentWorkflows;

        try {
            workflow = await this.workflowRepository.findOne({ where: { workflowId: id } });

            if (!workflow) {
                return {
                    success: false,
                    error: {
                        code: 'WORKFLOW_NOT_FOUND',
                        message: `Workflow with ID ${id} not found`,
                    },
                };
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'WORKFLOW_FETCH_FAILED',
                    message: 'Failed to fetch workflow',
                    details: { error: error.message },
                },
            };
        }

        switch (workflow.workflowLang) {
            case OB1Workflow.WorkflowLang.TYPESCRIPT:
                return this.workflowTypeScriptV1Service.testWorkflow(
                    {
                        workflowCode: workflow.workflowCode,
                        workflowInputSchema: workflow.workflowInputSchema,
                        workflowOutputSchema: workflow.workflowOutputSchema,
                        workflowImports: workflow.workflowImports,
                    },
                    workflowInput,
                );
            default:
                throw new BadRequestException(`Unsupported workflowLang: ${workflow.workflowLang}`);
        }
    }
}
