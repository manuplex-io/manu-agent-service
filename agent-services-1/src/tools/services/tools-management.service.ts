// src/tools/services/tools-management.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1ToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import {
    CreateToolDto,
    UpdateToolDto,
    CreateCategoryDto,
    UpdateCategoryDto,
    ToolResponseDto,
    ServiceResponse,
    ToolStatus,
    ToolQueryParams,
    PaginatedResponse,
    ToolUpdateResult
} from '../interfaces/tools.interface';

@Injectable()
export class ToolsManagementService {
    constructor(
        @InjectRepository(OB1AgentTools)
        private toolsRepository: Repository<OB1AgentTools>,
        @InjectRepository(OB1ToolCategory)
        private categoryRepository: Repository<OB1ToolCategory>
    ) { }

    // Tool Methods
    async createTool(createToolDto: CreateToolDto): Promise<ServiceResponse<ToolResponseDto>> {
        try {
            const category = createToolDto.categoryId
                ? await this.categoryRepository.findOne({ where: { toolCategoryId: createToolDto.categoryId } })
                : null;

            if (createToolDto.categoryId && !category) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: 'Category not found'
                    }
                };
            }

            const tool = this.toolsRepository.create({
                ...createToolDto,
                category,
                toolStatus: createToolDto.toolStatus || ToolStatus.TESTING
            });

            const savedTool = await this.toolsRepository.save(tool);
            return {
                success: true,
                data: this.mapToToolResponse(savedTool)
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_CREATION_FAILED',
                    message: 'Failed to create tool',
                    details: { error: error.message }
                }
            };
        }
    }

    async getTools(params: ToolQueryParams): Promise<ServiceResponse<PaginatedResponse<ToolResponseDto>>> {
        try {
            const { status, categoryId, tags, toolType, search, page = 1, limit = 10 } = params;

            const queryBuilder = this.toolsRepository
                .createQueryBuilder('tool')
                .leftJoinAndSelect('tool.category', 'category');

            if (status) {
                queryBuilder.andWhere('tool.toolStatus = :status', { status });
            }

            if (categoryId) {
                queryBuilder.andWhere('category.toolCategoryId = :categoryId', { categoryId });
            }

            if (tags && tags.length > 0) {
                queryBuilder.andWhere('tool.tags @> :tags', { tags });
            }

            if (toolType) {
                queryBuilder.andWhere('tool.toolType = :toolType', { toolType });
            }

            if (search) {
                queryBuilder.andWhere(
                    '(tool.toolName ILIKE :search OR tool.toolDescription ILIKE :search)',
                    { search: `%${search}%` }
                );
            }

            const total = await queryBuilder.getCount();
            const tools = await queryBuilder
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return {
                success: true,
                data: {
                    items: tools.map(tool => this.mapToToolResponse(tool)),
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_FETCH_FAILED',
                    message: 'Failed to fetch tools',
                    details: { error: error.message }
                }
            };
        }
    }

    async getTool(id: string): Promise<ServiceResponse<ToolResponseDto>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id },
                relations: ['category']
            });

            if (!tool) {
                return {
                    success: false,
                    error: {
                        code: 'TOOL_NOT_FOUND',
                        message: `Tool with ID ${id} not found`
                    }
                };
            }

            return {
                success: true,
                data: this.mapToToolResponse(tool)
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_FETCH_FAILED',
                    message: 'Failed to fetch tool',
                    details: { error: error.message }
                }
            };
        }
    }

    async getFullTool(id: string): Promise<ServiceResponse<ToolResponseDto>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id },
                relations: ['category']
            });

            if (!tool) {
                return {
                    success: false,
                    error: {
                        code: 'TOOL_NOT_FOUND',
                        message: `Tool with ID ${id} not found`
                    }
                };
            }

            return {
                success: true,
                data: tool,
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_FETCH_FAILED',
                    message: 'Failed to fetch tool',
                    details: { error: error.message }
                }
            };
        }
    }

    async updateTool(id: string, updateToolDto: UpdateToolDto): Promise<ServiceResponse<ToolUpdateResult>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id },
                relations: ['category']
            });

            if (!tool) {
                return {
                    success: false,
                    error: {
                        code: 'TOOL_NOT_FOUND',
                        message: `Tool with ID ${id} not found`
                    }
                };
            }

            const previousVersion = this.mapToToolResponse(tool);
            const changes: string[] = [];

            if (updateToolDto.categoryId) {
                const category = await this.categoryRepository.findOne({
                    where: { toolCategoryId: updateToolDto.categoryId }
                });
                if (!category) {
                    return {
                        success: false,
                        error: {
                            code: 'CATEGORY_NOT_FOUND',
                            message: 'Category not found'
                        }
                    };
                }
                tool.category = category;
                changes.push('category');
            }

            // Track changes
            Object.keys(updateToolDto).forEach(key => {
                if (updateToolDto[key] !== undefined && tool[key] !== updateToolDto[key]) {
                    changes.push(key);
                }
            });

            Object.assign(tool, updateToolDto);
            const updatedTool = await this.toolsRepository.save(tool);

            return {
                success: true,
                data: {
                    previousVersion,
                    updatedVersion: this.mapToToolResponse(updatedTool),
                    changes
                }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_UPDATE_FAILED',
                    message: 'Failed to update tool',
                    details: { error: error.message }
                }
            };
        }
    }

    async deleteTool(id: string): Promise<ServiceResponse<void>> {
        try {
            const result = await this.toolsRepository.delete(id);
            if (result.affected === 0) {
                return {
                    success: false,
                    error: {
                        code: 'TOOL_NOT_FOUND',
                        message: `Tool with ID ${id} not found`
                    }
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'TOOL_DELETE_FAILED',
                    message: 'Failed to delete tool',
                    details: { error: error.message }
                }
            };
        }
    }

    // Category Methods
    async createCategory(createCategoryDto: CreateCategoryDto): Promise<ServiceResponse<OB1ToolCategory>> {
        try {
            const category = this.categoryRepository.create(createCategoryDto);
            const savedCategory = await this.categoryRepository.save(category);
            return {
                success: true,
                data: savedCategory
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_CREATION_FAILED',
                    message: 'Failed to create category',
                    details: { error: error.message }
                }
            };
        }
    }

    async getCategories(): Promise<ServiceResponse<OB1ToolCategory[]>> {
        try {
            const categories = await this.categoryRepository.find();
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

    async updateCategory(id: string, updateCategoryDto: UpdateCategoryDto): Promise<ServiceResponse<OB1ToolCategory>> {
        try {
            const category = await this.categoryRepository.findOne({
                where: { toolCategoryId: id }
            });

            if (!category) {
                return {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: `Category with ID ${id} not found`
                    }
                };
            }

            Object.assign(category, updateCategoryDto);
            const updatedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: updatedCategory
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'CATEGORY_UPDATE_FAILED',
                    message: 'Failed to update category',
                    details: { error: error.message }
                }
            };
        }
    }

    async deleteCategory(id: string): Promise<ServiceResponse<void>> {
        try {
            const result = await this.categoryRepository.delete(id);
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
                    message: 'Failed to delete category',
                    details: { error: error.message }
                }
            };
        }
    }

    // Helper Methods
    private mapToToolResponse(tool: OB1AgentTools): ToolResponseDto {
        return {
            toolId: tool.toolId,
            toolName: tool.toolName,
            toolDescription: tool.toolDescription,
            toolType: tool.toolType,
            toolStatus: tool.toolStatus,
            category: tool.category ? {
                toolCategoryId: tool.category.toolCategoryId,
                toolCategoryName: tool.category.toolCategoryName
            } : undefined,
            createdAt: tool.createdAt,
            updatedAt: tool.updatedAt
        };
    }

}