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
export class ToolsManagementV1Service {
    constructor(
        @InjectRepository(OB1AgentTools)
        private toolsRepository: Repository<OB1AgentTools>,
        @InjectRepository(OB1ToolCategory)
        private toolCategoryRepository: Repository<OB1ToolCategory>
    ) { }

    // Tool Methods
    async createTool(createToolDto: CreateToolDto): Promise<ServiceResponse<ToolResponseDto>> {
        try {
            const toolCategory = createToolDto.toolCategoryId
                ? await this.toolCategoryRepository.findOne({ where: { toolCategoryId: createToolDto.toolCategoryId } })
                : null;

            if (createToolDto.toolCategoryId && !toolCategory) {
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
                toolCategory,
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
            const { toolStatus, toolCategoryId, toolTags, toolType, search, page = 1, limit = 10 } = params;

            const queryBuilder = this.toolsRepository
                .createQueryBuilder('tool')
                .leftJoinAndSelect('tool.toolCategory', 'toolCategory');

            if (toolStatus) {
                queryBuilder.andWhere('tool.toolStatus = :toolStatus', { toolStatus });
            }

            if (toolCategoryId) {
                queryBuilder.andWhere('toolCategory.toolCategoryId = :toolCategoryId', { toolCategoryId });
            }

            if (toolTags && toolTags.length > 0) {
                queryBuilder.andWhere('tool.toolTags @> :toolTags', { toolTags });
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
                relations: ['toolCategory']
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
                relations: ['toolCategory']
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
                relations: ['toolCategory']
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

            if (updateToolDto.toolCategoryId) {
                const toolCategory = await this.toolCategoryRepository.findOne({
                    where: { toolCategoryId: updateToolDto.toolCategoryId }
                });
                if (!toolCategory) {
                    return {
                        success: false,
                        error: {
                            code: 'CATEGORY_NOT_FOUND',
                            message: 'Category not found'
                        }
                    };
                }
                tool.toolCategory = toolCategory;
                changes.push('toolCategory');
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
    async createToolCategory(createCategoryDto: CreateCategoryDto): Promise<ServiceResponse<OB1ToolCategory>> {
        try {
            const toolCategory = this.toolCategoryRepository.create(createCategoryDto);
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

    async getToolCategories(): Promise<ServiceResponse<OB1ToolCategory[]>> {
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

    async updateToolCategory(id: string, updateCategoryDto: UpdateCategoryDto): Promise<ServiceResponse<OB1ToolCategory>> {
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

    async deleteToolCategory(id: string): Promise<ServiceResponse<void>> {
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

    // Helper Methods
    private mapToToolResponse(tool: OB1AgentTools): ToolResponseDto {
        return {
            toolId: tool.toolId,
            toolName: tool.toolName,
            toolDescription: tool.toolDescription,
            toolType: tool.toolType,
            toolStatus: tool.toolStatus,
            toolCategory: tool.toolCategory ? {
                toolCategoryId: tool.toolCategory.toolCategoryId,
                toolCategoryName: tool.toolCategory.toolCategoryName
            } : undefined,
            toolCreatedAt: tool.toolCreatedAt,
            toolUpdatedAt: tool.toolUpdatedAt
        };
    }

}