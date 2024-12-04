// src/tools/services/toolsManagementV1.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1AgentToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import {
    OB1Tool
} from '../interfaces/tools.interface';

@Injectable()
export class ToolsManagementV1Service {
    constructor(
        @InjectRepository(OB1AgentTools) private toolsRepository: Repository<OB1AgentTools>,
        @InjectRepository(OB1AgentToolCategory) private toolCategoryRepository: Repository<OB1AgentToolCategory>
    ) { }

    // Tool Methods
    async createTool(createToolDto: OB1Tool.CreateTool): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
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
                toolStatus: createToolDto.toolStatus || OB1Tool.ToolStatus.TESTING,
                toolCreatedByConsultantOrgShortName: createToolDto.consultantOrgShortName,
                toolCreatedByPersonId: createToolDto.personId
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

    async getTools(params: OB1Tool.ToolQueryParamsDto): Promise<OB1Tool.ServiceResponse<OB1Tool.PaginatedResponse<OB1Tool.ToolResponseDto>>> {
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

    async getTool(id: string): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
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

    async getFullTool(id: string): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
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

    async updateTool(id: string, updateToolDto: OB1Tool.UpdateTool): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolUpdateResult>> {
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

    async deleteTool(id: string): Promise<OB1Tool.ServiceResponse<void>> {
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

    // Helper Methods
    private mapToToolResponse(tool: OB1AgentTools): OB1Tool.ToolResponseDto {
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