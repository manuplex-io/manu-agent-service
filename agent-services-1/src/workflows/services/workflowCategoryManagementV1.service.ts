// /src/workflows/services/workflowCategoryManagementV1.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OB1AgentWorkflowCategory } from '../entities/ob1-agent-workflowCategory.entity';
import { OB1Workflow } from '../interfaces/workflow.interface';

@Injectable()
export class WorkflowCategoryManagementV1Service {
    private readonly logger = new Logger(WorkflowCategoryManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentWorkflowCategory)
        private readonly categoryRepository: Repository<OB1AgentWorkflowCategory>,
    ) { }

    // Create Workflow Category
    async createCategory(
        createCategoryDto: OB1Workflow.CreateCategory,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.CategoryResponse>> {
        try {
            const transformedCategoryDto = {
                ...createCategoryDto,
                workflowCategoryCreatedByPersonId: createCategoryDto.personId,
                workflowCategoryCreatedByConsultantOrgShortName: createCategoryDto.consultantOrgShortName,
            };

            const category = this.categoryRepository.create(transformedCategoryDto);
            const savedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(savedCategory),
            };
        } catch (error) {
            this.logger.error(`Failed to create workflow category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create workflow category',
                code: 'CATEGORY_CREATION_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Get All Workflow Categories
    async getCategories(): Promise<OB1Workflow.ServiceResponse<OB1Workflow.CategoryResponse[]>> {
        try {
            const categories = await this.categoryRepository.find();

            return {
                success: true,
                data: categories.map(this.mapToCategoryResponse),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch workflow categories: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch workflow categories',
                code: 'CATEGORY_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Get Single Workflow Category by ID
    async getCategory(
        id: string,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { workflowCategoryId: id } });

            if (!category) {
                throw new BadRequestException({
                    message: `Workflow category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });

            }

            return {
                success: true,
                data: this.mapToCategoryResponse(category),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch workflow category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch workflow category',
                code: 'CATEGORY_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Update Workflow Category
    async updateCategory(
        id: string,
        updateCategoryDto: OB1Workflow.UpdateCategory,
    ): Promise<OB1Workflow.ServiceResponse<OB1Workflow.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { workflowCategoryId: id } });

            if (!category) {
                throw new BadRequestException({
                    message: `Workflow category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            Object.assign(category, updateCategoryDto);
            const updatedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(updatedCategory),
            };
        } catch (error) {
            this.logger.error(`Failed to update workflow category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update workflow category',
                code: 'CATEGORY_UPDATE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Delete Workflow Category
    async deleteCategory(id: string): Promise<OB1Workflow.ServiceResponse<void>> {
        try {
            const result = await this.categoryRepository.delete(id);

            if (result.affected === 0) {
                throw new BadRequestException({
                    message: `Workflow category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to delete workflow category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete workflow category',
                code: 'CATEGORY_DELETE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Helper Method: Map to Category Response
    private mapToCategoryResponse(
        category: OB1AgentWorkflowCategory,
    ): OB1Workflow.CategoryResponse {
        return {
            workflowCategoryId: category.workflowCategoryId,
            workflowCategoryName: category.workflowCategoryName,
            workflowCategoryDescription: category.workflowCategoryDescription,
            workflowCategoryCreatedByPersonId: category.workflowCategoryCreatedByPersonId,
            workflowCategoryCreatedByConsultantOrgShortName: category.workflowCategoryCreatedByConsultantOrgShortName,
        };
    }
}
