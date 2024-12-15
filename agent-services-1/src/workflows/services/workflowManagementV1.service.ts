// /src/workflows/services/workflowManagementV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { OB1AgentWorkflows } from '../entities/ob1-agent-workflows.entity';
import { OB1AgentWorkflowCategory } from '../entities/ob1-agent-workflowCategory.entity';
import { OB1AgentWorkflowActivities } from '../entities/ob1-agent-workflowActivities.entity';
import { OB1AgentActivities } from '../../activity/entities/ob1-agent-activities.entity';

import { OB1Workflow } from '../interfaces/workflow.interface';
//import { OB1Activity } from '../../activity/interfaces/activity.interface';

import { WorkflowTestingV1Service } from 'src/workflows/services/testing/workflowTestingV1.service';
import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
@Injectable()
export class WorkflowManagementV1Service {
    private readonly logger = new Logger(WorkflowManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentWorkflows) private readonly workflowRepository: Repository<OB1AgentWorkflows>,
        @InjectRepository(OB1AgentWorkflowCategory) private readonly workflowCategoryRepository: Repository<OB1AgentWorkflowCategory>,
        @InjectRepository(OB1AgentWorkflowActivities) private readonly workflowActivitiesRepository: Repository<OB1AgentWorkflowActivities>,
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        private readonly workflowTestingV1Service: WorkflowTestingV1Service,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }

    // Create Workflow
    async createWorkflow(
        workflow: OB1Workflow.CreateWorkflow,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.WorkflowResponse>> {
        try {
            // Fetch Workflow Category
            this.logger.debug(`Creating workflow: ${JSON.stringify(workflow, null, 2)}`);
            const category = await this.workflowCategoryRepository.findOne({
                where: {
                    workflowCategoryId: workflow.workflowCategoryId,
                    workflowCategoryCreatedByConsultantOrgShortName: workflow.consultantOrgShortName,
                },
            });

            if (!category) {
                throw new BadRequestException({
                    message: 'Workflow category not found',
                    code: 'CATEGORY_NOT_FOUND',
                });
            }
            //this.logger.debug(`Category found & checking Activities: ${JSON.stringify(category, null, 2)}`);
            // Verify Activities
            if (!workflow.activitiesUsedByWorkflow || workflow.activitiesUsedByWorkflow.length === 0) {
                throw new BadRequestException({
                    message: 'No activities provided in Workflow, they must be provided',
                    code: 'NO_ACTIVITIES_PROVIDED',
                });
            }


            const activities = await this.activityRepository.find({
                where: {
                    activityId: In(workflow.activitiesUsedByWorkflow),
                },
            });
            //this.logger.debug(`Activities found & checking against workflow Activities: ${JSON.stringify(activities, null, 2)}`);


            if (activities.length !== workflow.activitiesUsedByWorkflow.length) {
                const foundIds = activities.map((a) => a.activityId);
                const missingIds = workflow.activitiesUsedByWorkflow.filter((id) => !foundIds.includes(id));
                throw new BadRequestException({
                    message: 'Some activities were not found',
                    code: 'ACTIVITIES_NOT_FOUND',
                    details: { missingActivityIds: missingIds },
                });
            }

            //this.logger.debug(`Activities found & going to validation: ${JSON.stringify(activities, null, 2)}`);
            // TODO: Validate workflow using a validateAnyWorkflow method
            await this.workflowTestingV1Service.validateAnyWorkflow(workflow);

            // CODE CLEANUP - Series of code cleanup steps
            const codeCleanup1 = this.tsValidationOb1Service.updateConfigInputToOptionalIfUnused(workflow.workflowCode);
            const codeCleanup2 = this.tsValidationOb1Service.removeExportDefaultModifiers(codeCleanup1);

            // Update workflow code if it has changed
            if (codeCleanup2 !== workflow.workflowCode) {
                workflow.workflowCode = codeCleanup2;
            }
            // Create New Workflow
            const newWorkflow = this.workflowRepository.create({
                ...workflow,
                workflowCategory: category,
                workflowCreatedByConsultantOrgShortName: workflow.consultantOrgShortName,
                workflowCreatedByPersonId: workflow.personId,
            });

            const savedWorkflow = await this.workflowRepository.save(newWorkflow);

            // Link Activities to Workflow
            const workflowActivities = activities.map((activity) => {
                return this.workflowActivitiesRepository.create({
                    workflow: savedWorkflow,
                    activity: activity,
                });
            });

            await this.workflowActivitiesRepository.save(workflowActivities);

            // Fetch the workflow with activities for response
            const fullWorkflow = await this.workflowRepository.findOne({
                where: { workflowId: savedWorkflow.workflowId },
                relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
            });

            return {
                success: true,
                data: this.mapToWorkflowResponse(fullWorkflow),
            };
        } catch (error) {
            this.logger.log(`Failed to create workflow:\n${JSON.stringify(error, null, 2)}`);
            throw new BadRequestException({
                message: 'Failed to create workflow',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Fetch Workflow
    async getWorkflow(
        id: string,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.WorkflowResponseDto>> {
        try {
            const workflow = await this.workflowRepository.findOne({
                where: { workflowId: id },
                relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
            });

            if (!workflow) {
                throw new BadRequestException({
                    message: `Workflow with ID ${id} not found`,
                    code: 'WORKFLOW_NOT_FOUND',
                });
            }

            return {
                success: true,
                data: workflow,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch workflow: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch workflow',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Fetch Workflows (Paginated)
    async getWorkflows(
        params: OB1Workflow.WorkflowQueryParams,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.PaginatedResponse<OB1Workflow.WorkflowResponse>>> {
        try {
            const { consultantOrgShortName, workflowCategoryId, search, page = 1, limit = 10 } = params;

            const queryBuilder = this.workflowRepository
                .createQueryBuilder('workflow')
                .leftJoinAndSelect('workflow.workflowCategory', 'workflowCategory')
                .leftJoinAndSelect('workflow.workflowActivities', 'workflowActivities')
                .leftJoinAndSelect('workflowActivities.activity', 'activity')
                .where('workflow.workflowCreatedByConsultantOrgShortName = :consultantOrgShortName', { consultantOrgShortName });

            if (workflowCategoryId) {
                queryBuilder.andWhere('workflowCategory.workflowCategoryId = :workflowCategoryId', {
                    workflowCategoryId,
                });
            }

            if (search) {
                queryBuilder.andWhere(
                    '(workflow.workflowName ILIKE :search OR workflow.workflowDescription ILIKE :search)',
                    { search: `%${search}%` },
                );
            }

            const total = await queryBuilder.getCount();
            const workflows = await queryBuilder
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return {
                success: true,
                data: {
                    items: workflows.map(this.mapToWorkflowResponse),
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to fetch workflows: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch workflows',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Update Workflow (Creates a new version)
    async updateWorkflow(
        id: string,
        updates: OB1Workflow.UpdateWorkflow,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.WorkflowUpdateResult>> {
        try {
            const workflow = await this.workflowRepository.findOne({
                where: { workflowId: id },
                relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
            });

            if (!workflow) {
                throw new BadRequestException({
                    message: `Workflow with ID ${id} not found`,
                    code: 'WORKFLOW_NOT_FOUND',
                });
            }

            // Fetch the previous version
            const previousVersion = this.mapToWorkflowResponse(workflow);

            // Handle activitiesUsedByWorkflow updates
            let activities: OB1AgentActivities[] = [];
            if (updates.activitiesUsedByWorkflow && updates.activitiesUsedByWorkflow.length > 0) {
                // Verify Activities
                activities = await this.activityRepository.find({
                    where: {
                        activityId: In(updates.activitiesUsedByWorkflow),
                    },
                });

                if (activities.length !== updates.activitiesUsedByWorkflow.length) {
                    const foundIds = activities.map((a) => a.activityId);
                    const missingIds = updates.activitiesUsedByWorkflow.filter((id) => !foundIds.includes(id));
                    throw new BadRequestException({
                        message: 'Some activities were not found',
                        code: 'ACTIVITIES_NOT_FOUND',
                        details: { missingActivityIds: missingIds },
                    });
                }
            } else {
                // If no activities provided, retain the existing ones
                activities = workflow.workflowActivities.map((wa) => wa.activity);
            }

            if (updates.workflowCode) {
                const updatedWorkflowCode = this.tsValidationOb1Service.updateConfigInputToOptionalIfUnused(updates.workflowCode);
                if (updatedWorkflowCode !== updates.workflowCode) {
                    updates.workflowCode = updatedWorkflowCode;
                }
            }

            // Prepare the updated fields for the new version
            const newWorkflowData = {
                ...workflow,
                ...updates, // Apply updates
                workflowId: undefined, // Ensure new record is created
            };

            // Create New Workflow
            const newWorkflow = this.workflowRepository.create({
                ...newWorkflowData,
                workflowCreatedByPersonId: workflow.workflowCreatedByPersonId,
                workflowCreatedByConsultantOrgShortName: workflow.workflowCreatedByConsultantOrgShortName,
                workflowCategory: workflow.workflowCategory,
                workflowCreatedAt: workflow.workflowCreatedAt,
            });

            const savedWorkflow = await this.workflowRepository.save(newWorkflow);

            // Link Activities to New Workflow
            const workflowActivities = activities.map((activity) => {
                return this.workflowActivitiesRepository.create({
                    workflow: savedWorkflow,
                    activity: activity,
                });
            });

            await this.workflowActivitiesRepository.save(workflowActivities);

            // Fetch the workflow with activities for response
            const fullWorkflow = await this.workflowRepository.findOne({
                where: { workflowId: savedWorkflow.workflowId },
                relations: ['workflowCategory', 'workflowActivities', 'workflowActivities.activity'],
            });

            return {
                success: true,
                data: {
                    previousVersion,
                    updatedVersion: this.mapToWorkflowResponse(fullWorkflow),
                    changes: Object.keys(updates),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to update workflow: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update workflow',
                code: 'WORKFLOW_UPDATE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Delete Workflow
    async deleteWorkflow(id: string): Promise<OB1Workflow.ServiceResponse<void>> {
        try {
            const workflow = await this.workflowRepository.findOne({
                where: { workflowId: id },
            });

            if (!workflow) {
                throw new BadRequestException({
                    message: `Workflow with ID ${id} not found`,
                    code: 'WORKFLOW_NOT_FOUND',
                });
            }

            await this.workflowRepository.remove(workflow);
            return {
                success: true,
            };
        } catch (error) {
            this.logger.error(`Failed to delete workflow: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete workflow',
                code: 'WORKFLOW_DELETE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Map to Workflow Response
    private mapToWorkflowResponse(workflow: OB1AgentWorkflows): OB1Workflow.WorkflowResponse {
        return {
            workflowId: workflow.workflowId,
            workflowName: workflow.workflowName,
            workflowExternalName: workflow.workflowExternalName,
            workflowDescription: workflow.workflowDescription,
            workflowLang: workflow.workflowLang,
            workflowType: workflow.workflowType,
            workflowCategory: workflow.workflowCategory
                ? {
                    workflowCategoryId: workflow.workflowCategory.workflowCategoryId,
                    workflowCategoryName: workflow.workflowCategory.workflowCategoryName
                   
                }
                : undefined,
            activitiesUsedByWorkflow: workflow.workflowActivities
                ? workflow.workflowActivities.map((wa) => ({
                    activityId: wa.activity.activityId,
                    activityName: wa.activity.activityName,
                }))
                : [],
            workflowCreatedAt: workflow.workflowCreatedAt,
            workflowUpdatedAt: workflow.workflowUpdatedAt,
        };
    }
}
