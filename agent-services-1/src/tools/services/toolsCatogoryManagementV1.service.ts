// src/tools/services/toolsCatogoryManagementV1.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import { OB1Tool } from '../interfaces/tools.interface';

@Injectable()
export class ToolsCatogoryManagementV1Service {
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
            throw new BadRequestException({
                message: 'Category not found',
                code: 'CATEGORY_NOT_FOUND',
                details: { error: error.message }
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
            throw new BadRequestException({
                message: 'Failed to fetch categories',
                code: 'CATEGORY_FETCH_FAILED',
                details: { error: error.message }
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
                    message: `Category with ID ${id} not found`,
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
            throw new BadRequestException({
                message: 'Failed to update category',
                code: 'CATEGORY_UPDATE_FAILED',
                details: { error: error.message }
            });
        }
    }

    async deleteToolCategory(id: string): Promise<OB1Tool.ServiceResponse<void>> {
        try {
            const result = await this.toolCategoryRepository.delete(id);
            if (result.affected === 0) {
                throw new BadRequestException({
                    message: `Category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND'
                });
            }

            return { success: true };
        } catch (error) {
            throw new BadRequestException({
                message: 'Failed to delete category',
                code: 'CATEGORY_DELETE_FAILED',
                details: { error: error.message }
            });
        }
    }

}