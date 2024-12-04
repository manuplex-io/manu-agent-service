// src/tools/services/toolsCatogoryManagementV1.service.ts

import { Injectable } from '@nestjs/common';
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
            return {
                success: false,
                error: {
                    code: 'CATEGORY_CREATION_FAILED',
                    message: 'Failed to create toolCategory',
                    details: { error: error.message }
                }
            };
        }
    }

    async getToolCategories(): Promise<OB1Tool.ServiceResponse<OB1AgentToolCategory[]>> {
        try {
            const categories = await this.toolCategoryRepository.find();
            return {
                success: true,
                data: categories
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_FETCH_FAILED',
                    message: 'Failed to fetch categories',
                    details: { error: error.message }
                }
            };
        }
    }

    async updateToolCategory(id: string, updateCategoryDto: OB1Tool.UpdateCategory): Promise<OB1Tool.ServiceResponse<OB1AgentToolCategory>> {
        try {
            const toolCategory = await this.toolCategoryRepository.findOne({
                where: { toolCategoryId: id }
            });

            if (!toolCategory) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`
                    }
                };
            }

            Object.assign(toolCategory, updateCategoryDto);
            const updatedCategory = await this.toolCategoryRepository.save(toolCategory);

            return {
                success: true,
                data: updatedCategory
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_UPDATE_FAILED',
                    message: 'Failed to update toolCategory',
                    details: { error: error.message }
                }
            };
        }
    }

    async deleteToolCategory(id: string): Promise<OB1Tool.ServiceResponse<void>> {
        try {
            const result = await this.toolCategoryRepository.delete(id);
            if (result.affected === 0) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`
                    }
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_DELETE_FAILED',
                    message: 'Failed to delete toolCategory',
                    details: { error: error.message }
                }
            };
        }
    }

}