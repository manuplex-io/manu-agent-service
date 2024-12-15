// src/tools/services/toolsCatogoryManagementV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import { OB1Tool } from '../interfaces/tools.interface';

@Injectable()
export class ToolsCatogoryManagementV1Service {
    private readonly logger = new Logger(ToolsCatogoryManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentToolCategory) private toolCategoryRepository: Repository<OB1AgentToolCategory>
    ) { }

    // Category Methods
    async createToolCategory(createCategoryDto: OB1Tool.CreateCategory): Promise<OB1Tool.ServiceResponse<OB1AgentToolCategory>> {
        try {
            const toolCategory = this.toolCategoryRepository.create({
                ...createCategoryDto,
                toolCategoryCreatedByConsultantOrgShortName: createCategoryDto.consultantOrgShortName,
                toolCategoryCreatedByPersonId: createCategoryDto.personId
            });
            const savedCategory = await this.toolCategoryRepository.save(toolCategory);
            return {
                success: true,
                data: savedCategory
            };
        } catch (error) {
            this.logger.error(`Failed to create tool category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create tool category',
                code: 'CATEGORY_CREATION_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

    async getToolCategories(
        getCategoryBody: OB1Tool.GetCategory
    ): Promise<OB1Tool.ServiceResponse<OB1AgentToolCategory[]>> {
        try {
            const { consultantOrgShortName } = getCategoryBody;
            const categories = await this.toolCategoryRepository.find({
                where: {
                    toolCategoryCreatedByConsultantOrgShortName: consultantOrgShortName
                }
            });
            return {
                success: true,
                data: categories
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tool categories: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tool categories',
                code: 'CATEGORY_FETCH_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

    async updateToolCategory(id: string, updateCategoryDto: OB1Tool.UpdateCategory): Promise<OB1Tool.ServiceResponse<OB1AgentToolCategory>> {
        try {
            const toolCategory = await this.toolCategoryRepository.findOne({
                where: { toolCategoryId: id }
            });

            if (!toolCategory) {
                throw new BadRequestException({
                    message: `Tool category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND'
                });
            }

            Object.assign(toolCategory, updateCategoryDto);
            const updatedCategory = await this.toolCategoryRepository.save(toolCategory);

            return {
                success: true,
                data: updatedCategory
            };
        } catch (error) {
            this.logger.error(`Failed to update tool category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update tool category',
                code: 'CATEGORY_UPDATE_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

    async deleteToolCategory(id: string): Promise<OB1Tool.ServiceResponse<void>> {
        try {
            const result = await this.toolCategoryRepository.delete(id);
            if (result.affected === 0) {
                throw new BadRequestException({
                    message: `Tool category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND'
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to delete tool category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete tool category',
                code: 'CATEGORY_DELETE_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }
}