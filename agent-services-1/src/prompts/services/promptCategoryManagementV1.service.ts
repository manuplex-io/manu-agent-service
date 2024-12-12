// /src/prompts/services/promptCategoryManagementV1.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OB1AgentPromptCategory } from '../entities/ob1-agent-promptCategory.entity';
import { OB1Prompt } from '../interfaces/prompt.interface';

@Injectable()
export class PromptCategoryManagementV1Service {
    private readonly logger = new Logger(PromptCategoryManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPromptCategory)
        private readonly categoryRepository: Repository<OB1AgentPromptCategory>,
    ) { }

    // Create Prompt Category
    async createCategory(
        createCategoryDto: OB1Prompt.CreateCategory,
    ): Promise<OB1Prompt.ServiceResponse<OB1Prompt.CategoryResponse>> {
        try {
            const transformedCategoryDto = {
                ...createCategoryDto,
                promptCategoryCreatedByPersonId: createCategoryDto.personId,
                promptCategoryCreatedByConsultantOrgShortName: createCategoryDto.consultantOrgShortName,
            };

            const category = this.categoryRepository.create(transformedCategoryDto);
            const savedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(savedCategory),
            };
        } catch (error) {
            this.logger.error(`Failed to create prompt category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create prompt category',
                code: 'CATEGORY_CREATION_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Get All Prompt Categories
    async getCategories(
        getCategoryBody: OB1Prompt.GetCategory,
    ): Promise<OB1Prompt.ServiceResponse<OB1Prompt.CategoryResponse[]>> {
        try {
            const { consultantOrgShortName } = getCategoryBody;
            const categories = await this.categoryRepository.find({
                where: {
                    promptCategoryCreatedByConsultantOrgShortName: consultantOrgShortName
                }
            });
            return {
                success: true,
                data: categories.map(category => this.mapToCategoryResponse(category)),
            };
        } catch (error) {
            this.logger.error(`Failed to get prompt categories: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to get prompt categories',
                code: 'CATEGORIES_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    private mapToCategoryResponse(category: OB1AgentPromptCategory): OB1Prompt.CategoryResponse {
        return {
            id: category.promptCategoryId,
            name: category.promptCategoryName,
            description: category.promptCategoryDescription,
            promptCategoryCreatedByPersonId: category.promptCategoryCreatedByPersonId,
            promptCategoryCreatedByConsultantOrgShortName: category.promptCategoryCreatedByConsultantOrgShortName,
        };
    }
}
