// src/workflows/services/workflow/workflowRepositoryV1.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentWorkflow, WorkflowStatus } from '../../entities/ob1-agent-workflow.entity';
import { OB1AgentActivity } from '../../entities/ob1-agent-activity.entity';
import * as ts from 'typescript';
import { CreateWorkflowDto, UpdateWorkflowDto, ListWorkflowsDto, WorkflowResponseDto } from '../../interfaces/workflow.interface';
import { plainToClass } from 'class-transformer';

@Injectable()
export class WorkflowRepositoryServiceV1 {
    private readonly logger = new Logger(WorkflowRepositoryServiceV1.name);

    constructor(
        @InjectRepository(OB1AgentWorkflow) private workflowRepository: Repository<OB1AgentWorkflow>,
        @InjectRepository(OB1AgentActivity) private activityRepository: Repository<OB1AgentActivity>
    ) { }

    async createWorkflow(createWorkflowDto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
        this.logger.debug(`Creating new workflow: ${JSON.stringify(createWorkflowDto)}`);

        // Validate workflow code
        await this.validateWorkflowCode(createWorkflowDto.workflowCode);

        // Validate and fetch referenced workflowActivities
        let activities: OB1AgentActivity[] = [];
        if (createWorkflowDto.workflowActivities?.length) {
            activities = await Promise.all(
                createWorkflowDto.workflowActivities.map(async ({ activityId }) => {
                    const activity = await this.activityRepository.findOne({ where: { activityId } });
                    if (!activity) {
                        throw new NotFoundException(`Activity with ID ${activityId} not found`);
                    }
                    return activity;
                })
            );
        }

        const workflow = this.workflowRepository.create({
            workflowName: createWorkflowDto.workflowName,
            workflowDescription: createWorkflowDto.workflowDescription,
            workflowCode: createWorkflowDto.workflowCode,
            workflowInputSchema: createWorkflowDto.workflowInputSchema || {},
            workflowOutputSchema: createWorkflowDto.workflowOutputSchema || {},
            workflowMetadata: createWorkflowDto.workflowMetadata || {},
            workflowStatus: WorkflowStatus.DRAFT,
            workflowActivities: activities,
            workflowExecutionCount: 0,
            workflowAvgExecutionTime: 0
        });

        const savedWorkflow = await this.workflowRepository.save(workflow);
        return plainToClass(WorkflowResponseDto, savedWorkflow);
    }

    async updateWorkflow(
        workflowId: string,
        updateWorkflowDto: UpdateWorkflowDto
    ): Promise<WorkflowResponseDto> {
        const workflow = await this.getWorkflow(workflowId);

        if (updateWorkflowDto.workflowCode) {
            await this.validateWorkflowCode(updateWorkflowDto.workflowCode);
        }

        // Update activities if provided
        if (updateWorkflowDto.workflowActivities) {
            const activities = await Promise.all(
                updateWorkflowDto.workflowActivities.map(async ({ activityId }) => {
                    const activity = await this.activityRepository.findOne({ where: { activityId } });
                    if (!activity) {
                        throw new NotFoundException(`Activity with ID ${activityId} not found`);
                    }
                    return activity;
                })
            );
            workflow.workflowActivities = activities;
        }

        // Update other fields
        Object.assign(workflow, {
            ...(updateWorkflowDto.workflowName && { workflowName: updateWorkflowDto.workflowName }),
            ...(updateWorkflowDto.workflowDescription && { workflowDescription: updateWorkflowDto.workflowDescription }),
            ...(updateWorkflowDto.workflowCode && { workflowCode: updateWorkflowDto.workflowCode }),
            ...(updateWorkflowDto.workflowInputSchema && { workflowInputSchema: updateWorkflowDto.workflowInputSchema }),
            ...(updateWorkflowDto.workflowOutputSchema && { workflowOutputSchema: updateWorkflowDto.workflowOutputSchema }),
            ...(updateWorkflowDto.workflowMetadata && { workflowMetadata: updateWorkflowDto.workflowMetadata }),
            ...(updateWorkflowDto.workflowStatus && { workflowStatus: updateWorkflowDto.workflowStatus })
        });

        const savedWorkflow = await this.workflowRepository.save(workflow);
        return plainToClass(WorkflowResponseDto, savedWorkflow);
    }

    async getWorkflow(workflowId: string): Promise<WorkflowResponseDto> {
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId },
            relations: ['workflowActivities']
        });

        if (!workflow) {
            throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
        }

        return plainToClass(WorkflowResponseDto, workflow);
    }

    async listWorkflows(filters: ListWorkflowsDto): Promise<WorkflowResponseDto[]> {
        const queryBuilder = this.workflowRepository
            .createQueryBuilder('workflow')
            .leftJoinAndSelect('workflow.workflowActivities', 'workflowActivities');

        if (filters?.workflowStatus) {
            queryBuilder.andWhere('workflow.workflowStatus = :status', { status: filters.workflowStatus });
        }

        if (filters?.activityId) {
            queryBuilder
                .innerJoin('workflow.workflowActivities', 'activity')
                .andWhere('activity.activityId = :activityId', { activityId: filters.activityId });
        }

        const workflows = await queryBuilder.getMany();
        return workflows.map(workflow => plainToClass(WorkflowResponseDto, workflow));
    }

    async deleteWorkflow(workflowId: string): Promise<void> {
        const result = await this.workflowRepository.delete(workflowId);
        if (result.affected === 0) {
            throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
        }
    }

    async updateWorkflowMetrics(
        workflowId: string,
        executionTime: number
    ): Promise<void> {
        const workflow = await this.getWorkflow(workflowId);

        const newAvgTime = (
            (workflow.workflowAvgExecutionTime * workflow.workflowExecutionCount + executionTime) /
            (workflow.workflowExecutionCount + 1)
        );

        await this.workflowRepository.update(workflowId, {
            workflowExecutionCount: () => '"executionCount" + 1',
            workflowAvgExecutionTime: newAvgTime
        });
    }

    private async validateWorkflowCode(workflowCode: string): Promise<void> {
        if (!workflowCode) {
            throw new BadRequestException('Workflow code cannot be empty');
        }

        // Basic TypeScript syntax validation
        const transpileResult = ts.transpileModule(workflowCode, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                strict: true
            }
        });

        if (transpileResult.diagnostics?.length) {
            const errors = transpileResult.diagnostics.map(diagnostic =>
                ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
            );
            throw new BadRequestException({
                message: 'Workflow code syntax validation failed',
                errors
            });
        }

        // Workflow-specific validation
        const sourceFile = ts.createSourceFile(
            'workflow.ts',
            workflowCode,
            ts.ScriptTarget.ES2020,
            true
        );

        const validationResult = {
            hasDefaultExport: false,
            hasProperWorkflowStructure: false,
            hasValidImports: true
        };

        const validateNode = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                // Check for allowed imports only
                const importText = node.getText(sourceFile);
                if (!importText.includes('@temporalio/workflow')) {
                    validationResult.hasValidImports = false;
                }
            }

            if (ts.isFunctionDeclaration(node) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
                validationResult.hasDefaultExport = true;
                validationResult.hasProperWorkflowStructure = this.validateWorkflowStructure(node);
            }

            ts.forEachChild(node, validateNode);
        };

        ts.forEachChild(sourceFile, validateNode);

        const validationErrors: string[] = [];

        if (!validationResult.hasValidImports) {
            validationErrors.push('Only @temporalio/workflow imports are allowed');
        }
        if (!validationResult.hasDefaultExport) {
            validationErrors.push('Workflow must have a default export function');
        }
        if (!validationResult.hasProperWorkflowStructure) {
            validationErrors.push('Workflow function must follow Temporal workflow structure');
        }

        if (validationErrors.length > 0) {
            throw new BadRequestException({
                message: 'Workflow validation failed',
                errors: validationErrors
            });
        }
    }

    private validateWorkflowStructure(node: ts.FunctionDeclaration): boolean {
        // Check for required workflow function structure
        return (
            node.parameters.length >= 1 && // At least one parameter for input
            !!node.type && // Has return type
            !node.parameters.some(param => // No prohibited parameter types
                param.type?.kind === ts.SyntaxKind.FunctionType ||
                param.type?.kind === ts.SyntaxKind.VoidKeyword
            )
        );
    }
}
