// src/workflows/services/activityRepositoryV1.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentActivity, ActivityType } from '../../entities/ob1-agent-activity.entity';
import { OB1AgentTools } from '../../../tools/entities/ob1-agent-tools.entity';
import * as ts from 'typescript';

@Injectable()
export class ActivityRepositoryServiceV1 {
    private readonly logger = new Logger(ActivityRepositoryServiceV1.name);
    constructor(
        @InjectRepository(OB1AgentActivity) private activityRepository: Repository<OB1AgentActivity>,
        @InjectRepository(OB1AgentTools) private toolsRepository: Repository<OB1AgentTools>
    ) { }

    async createActivity(activityData: Partial<OB1AgentActivity>): Promise<OB1AgentActivity> {
        this.logger.debug(`Attempting to create new activity with data: ${JSON.stringify(activityData)}`);

        if (activityData.activityType === ActivityType.TYPESCRIPT_CODE) {
            this.logger.debug('Validating TypeScript activity code...');
            await this.validateTypeScriptCodeBasic(activityData.activityCode);
        }

        if (activityData.tool) {
            this.logger.debug(`Fetching tool with ID: ${activityData.tool.toolId}`);
            const tool = await this.toolsRepository.findOne({
                where: { toolId: activityData.tool.toolId }
            });
            if (!tool) {
                this.logger.error(`Tool with ID ${activityData.tool.toolId} not found`);
                throw new NotFoundException(`Tool with ID ${activityData.tool.toolId} not found`);
            }
        }

        const activity = this.activityRepository.create({
            ...activityData,
            activityExecutionCount: 0,
            activityAvgExecutionTime: 0,
            activityRetryPolicy: activityData.activityRetryPolicy || {
                initialInterval: 1,
                backoffCoefficient: 2,
                maximumAttempts: 3,
                maximumInterval: 100
            }
        });

        const savedActivity = await this.activityRepository.save(activity);
        this.logger.log(`Activity created with ID: ${savedActivity.activityId}`);
        return savedActivity;
    }

    async updateActivity(
        activityId: string,
        updateData: Partial<OB1AgentActivity>
    ): Promise<OB1AgentActivity> {
        this.logger.debug(`Updating activity with ID: ${activityId}`);
        const activity = await this.getActivity(activityId);

        if (updateData.activityCode && activity.activityType === ActivityType.TYPESCRIPT_CODE) {
            this.logger.debug('Validating updated TypeScript activity code...');
            await this.validateTypeScriptCodeBasic(updateData.activityCode);
        }

        Object.assign(activity, updateData);
        const updatedActivity = await this.activityRepository.save(activity);
        this.logger.log(`Activity with ID ${activityId} updated`);
        return updatedActivity;
    }

    async getActivity(activityId: string): Promise<OB1AgentActivity> {
        this.logger.debug(`Retrieving activity with ID: ${activityId}`);
        const activity = await this.activityRepository.findOne({
            where: { activityId },
            relations: ['tool']
        });

        if (!activity) {
            this.logger.error(`Activity with ID ${activityId} not found`);
            throw new NotFoundException(`Activity with ID ${activityId} not found`);
        }

        return activity;
    }

    async listActivities(filters?: {
        toolId?: string;
        status?: string;
        activityType?: ActivityType;
    }): Promise<OB1AgentActivity[]> {
        const queryBuilder = this.activityRepository
            .createQueryBuilder('activity')
            .leftJoinAndSelect('activity.tool', 'tool');

        if (filters?.toolId) {
            queryBuilder.andWhere('tool.toolId = :toolId', { toolId: filters.toolId });
        }
        if (filters?.status) {
            queryBuilder.andWhere('activity.status = :status', { status: filters.status });
        }
        if (filters?.activityType) {
            queryBuilder.andWhere('activity.activityType = :activityType', { activityType: filters.activityType });
        }

        return queryBuilder.getMany();
    }

    async deleteActivity(activityId: string): Promise<void> {
        const result = await this.activityRepository.delete(activityId);
        if (result.affected === 0) {
            throw new NotFoundException(`Activity with ID ${activityId} not found`);
        }
    }

    async updateActivityMetrics(
        activityId: string,
        executionTime: number,
        success: boolean
    ): Promise<void> {
        const activity = await this.getActivity(activityId);

        const newAvgTime = (
            (activity.activityAvgExecutionTime * activity.activityExecutionCount + executionTime) /
            (activity.activityExecutionCount + 1)
        );

        await this.activityRepository.update(activityId, {
            activityExecutionCount: () => '"activityExecutionCount" + 1',
            activityAvgExecutionTime: newAvgTime
        });
    }


    private async validateTypeScriptCodeBasic(activityCode: string): Promise<void> {
        if (!activityCode) {
            this.logger.error('Validation failed: TypeScript activityCode cannot be empty');
            throw new BadRequestException('TypeScript activityCode cannot be empty');
        }

        // Use transpileModule to check for syntax errors without type checking
        const transpileResult = ts.transpileModule(activityCode, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                strict: true,
                noImplicitAny: true,
                noImplicitReturns: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
            }
        });

        const diagnostics = transpileResult.diagnostics;

        if (diagnostics && diagnostics.length > 0) {
            const errors = diagnostics.map(diagnostic => {
                let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    message = `Line ${line + 1}, Column ${character + 1}: ${message}`;
                }
                return message;
            });

            this.logger.error('TypeScript code syntax validation failed', JSON.stringify(errors));
            throw new BadRequestException({
                message: 'TypeScript activityCode syntax validation failed',
                errors
            });
        }

        // Proceed with structural validation
        this.logger.debug('Validating the structure of the activity code...');
        const sourceFile = ts.createSourceFile(
            'activity.ts',
            activityCode,
            ts.ScriptTarget.ES2020,
            true
        );

        let validationResult = {
            hasDefaultExport: false,
            hasAsyncFunction: false,
            hasTwoParameters: false,
            hasReturnType: false,
            hasInvalidImports: false
        };

        const validateNode = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                validationResult.hasInvalidImports = true;
            }

            if (ts.isFunctionDeclaration(node) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
                validationResult.hasDefaultExport = true;
                validationResult.hasAsyncFunction = node.modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
                validationResult.hasTwoParameters = (node.parameters?.length === 2);
                validationResult.hasReturnType = !!node.type;
            }

            if (ts.isExportAssignment(node) && !node.isExportEquals) {
                validationResult.hasDefaultExport = true;

                if (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression)) {
                    validationResult.hasAsyncFunction = node.expression.modifiers?.some(
                        m => m.kind === ts.SyntaxKind.AsyncKeyword
                    ) || ts.getCombinedModifierFlags(node.expression) & ts.ModifierFlags.Async ? true : false;
                    validationResult.hasTwoParameters = (node.expression.parameters?.length === 2);
                    validationResult.hasReturnType = !!node.expression.type;
                }
            }

            ts.forEachChild(node, validateNode);
        };

        ts.forEachChild(sourceFile, validateNode);

        const validationErrors: string[] = [];

        if (validationResult.hasInvalidImports) {
            validationErrors.push('Import statements are not allowed in activityCode');
        }
        if (!validationResult.hasDefaultExport) {
            validationErrors.push('Code must have a default export function');
        }
        if (!validationResult.hasAsyncFunction) {
            validationErrors.push('Default export must be an async function');
        }
        if (!validationResult.hasTwoParameters) {
            validationErrors.push('Function must accept exactly two parameters (input and config)');
        }
        if (!validationResult.hasReturnType) {
            validationErrors.push('Function should specify a return type');
        }

        if (validationErrors.length > 0) {
            this.logger.error('Activity code validation structure failed', JSON.stringify(validationErrors));
            throw new BadRequestException({
                message: 'Activity code validation failed',
                errors: validationErrors
            });
        }

        this.logger.debug('Activity code validated successfully.');
    }


}
