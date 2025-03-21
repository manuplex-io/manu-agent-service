// src/tools/services/toolsManagementV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { OB1AgentToolCategory } from '../entities/ob1-agent-toolCategory.entity';
import {
    OB1Tool
} from '../interfaces/tools.interface';

import { ToolsExecutionV1Service } from './toolsExecutionV1.service';

@Injectable()
export class ToolsManagementV1Service {
    private readonly logger = new Logger(ToolsManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentTools) private toolsRepository: Repository<OB1AgentTools>,
        @InjectRepository(OB1AgentToolCategory) private toolCategoryRepository: Repository<OB1AgentToolCategory>,
        private readonly toolsExecutionV1Service: ToolsExecutionV1Service
    ) { }

    // Tool Methods
    async createTool(createToolDto: OB1Tool.CreateTool): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
        try {
            const toolCategory = createToolDto.toolCategoryId
                ? await this.toolCategoryRepository.findOne({ where: { toolCategoryId: createToolDto.toolCategoryId } })
                : null;

            if (createToolDto.toolCategoryId && !toolCategory) {
                throw new BadRequestException({
                    message: `Category not found`,
                    code: 'CATEGORY_NOT_FOUND'
                });

            }

            //validate tool before saving using toolsExecutionV1Service.validateAnyTool
            const validationResponse = await this.toolsExecutionV1Service.validateAnyToolCode({
                toolName: createToolDto.toolName,
                toolCode: createToolDto.toolCode,
                toolPythonRequirements: createToolDto.toolPythonRequirements,
                toolType: createToolDto.toolType
            });

            if (!validationResponse.success) {
                throw new BadRequestException({
                    message: 'Failed to validate tool',
                    code: 'TOOL_VALIDATION_FAILED',
                    details: { error: validationResponse.message }
                });
            }


            const tool = this.toolsRepository.create({
                ...createToolDto,
                toolCategory,
                toolStatus: createToolDto.toolStatus || OB1Tool.ToolStatus.TESTING,
                toolCreatedByConsultantOrgShortName: createToolDto.consultantOrgShortName,
                toolCreatedByPersonId: createToolDto.personId
            });





            const savedTool = await this.toolsRepository.save(tool);

            //deploy the tool using toolsExecutionV1Service.deployAnyTool
            const deployResult = await this.toolsExecutionV1Service.deployAnyTool(savedTool.toolId);

            if (!deployResult.success) {
                throw new BadRequestException({
                    message: 'Failed to deploy tool',
                    code: 'TOOL_DEPLOYMENT_FAILED',
                    details: { error: deployResult.message }
                });
            }

            return {
                success: true,
                data: this.mapToToolResponse(savedTool)
            };
        } catch (error) {
            this.logger.error(`Failed to create tool: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create tool',
                code: 'TOOL_CREATION_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

    async getTools(params: OB1Tool.ToolQueryParamsDto): Promise<OB1Tool.ServiceResponse<OB1Tool.PaginatedResponse<OB1Tool.ToolResponseDto>>> {
        try {
            const { toolStatus, toolCategoryId, toolTags, toolType, search, consultantOrgShortName, page = 1, limit = 10 } = params;

            const queryBuilder = this.toolsRepository
                .createQueryBuilder('tool')
                .leftJoinAndSelect('tool.toolCategory', 'toolCategory')
                .where('tool.toolCreatedByConsultantOrgShortName = :consultantOrgShortName', { consultantOrgShortName });

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
            this.logger.error(`Failed to fetch tools: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tools',
                code: 'TOOL_FETCH_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

    // async getTool(id: string): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
    //     try {
    //         const tool = await this.toolsRepository.findOne({
    //             where: { toolId: id },
    //             relations: ['toolCategory']
    //         });

    //         if (!tool) {
    //             throw new BadRequestException({
    //                 message: `Tool with ID ${id} not found`,
    //                 code: 'TOOL_NOT_FOUND'
    //             });
    //         }

    //         return {
    //             success: true,
    //             data: this.mapToToolResponse(tool)
    //         };
    //     } catch (error) {
    //         this.logger.error(`Failed to fetch tool: ${error.message}`, error.stack);
    //         throw new BadRequestException({
    //             message: 'Failed to fetch tool',
    //             code: 'TOOL_FETCH_FAILED',
    //             errorSuperDetails: { ...error }
    //         });
    //     }
    // }

    async getTool(id: string): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id },
                relations: ['toolCategory']
            });

            if (!tool) {
                throw new BadRequestException({
                    message: `Tool with ID ${id} not found`,
                    code: 'TOOL_NOT_FOUND'
                });
            }

            return {
                success: true,
                data: tool,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tool: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tool',
                code: 'TOOL_FETCH_FAILED', 
                errorSuperDetails: { ...error }
            });
        }
    }

    async getToolByExternalName(externalName: string): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolExternalName: externalName },
                relations: ['toolCategory']
            });

            if (!tool) {
                throw new BadRequestException({
                    message: `Tool with external name ${externalName} not found`,
                    code: 'TOOL_NOT_FOUND'
                });
            }

            return {
                success: true,
                data: tool,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tool: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tool',
                code: 'TOOL_FETCH_FAILED', 
                errorSuperDetails: { ...error }
            });
        }
    }

    async getToolsByExternalNames(externalNames: string[]): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolResponseDto[]>> {
        try {
            const tools = await this.toolsRepository.find({
                where: { toolExternalName: In(externalNames) },
                relations: ['toolCategory']
            });
    
            if (tools.length === 0) {
                throw new BadRequestException({
                    message: `No tools found with the provided external names`,
                    code: 'TOOLS_NOT_FOUND'
                });
            }
    
            return {
                success: true,
                data: tools.map(tool => this.mapToToolResponse(tool)),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tools by external names: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tools',
                code: 'TOOLS_FETCH_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }
    
    async getToolIdsByExternalNames(externalNames: string[]): Promise<OB1Tool.ServiceResponse<{toolId: string, toolExternalName: string}[]>> {
        try {
            const tools = await this.toolsRepository.find({
                where: { toolExternalName: In(externalNames) },
                select: [
                    'toolId',
                    'toolExternalName',
                ]
            });
    
            if (tools.length === 0) {
                throw new BadRequestException({
                    message: `No tools found with the provided external names`,
                    code: 'TOOLS_NOT_FOUND'
                });
            }
    
            return {
                success: true,
                data: tools
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tools by external names: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tools',
                code: 'TOOLS_FETCH_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }
    

    async updateTool(id: string, updateToolDto: OB1Tool.UpdateTool): Promise<OB1Tool.ServiceResponse<OB1Tool.ToolUpdateResult>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id },
                relations: ['toolCategory']
            });

            if (!tool) {
                throw new BadRequestException({
                    message: `Tool with ID ${id} not found`,
                    code: 'TOOL_NOT_FOUND'
                });
            }

            const previousVersion = this.mapToToolResponse(tool);
            const changes: string[] = [];

            if (updateToolDto.toolCategoryId) {
                const toolCategory = await this.toolCategoryRepository.findOne({
                    where: { toolCategoryId: updateToolDto.toolCategoryId }
                });
                if (!toolCategory) {
                    throw new BadRequestException({
                        message: `Category not found`,
                        code: 'CATEGORY_NOT_FOUND'
                    });
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
            this.logger.error(`Failed to update tool: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update tool',
                code: 'TOOL_UPDATE_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }


    async deleteTool(id: string): Promise<OB1Tool.ServiceResponse<void>> {
        try {
            const tool = await this.toolsRepository.findOne({
                where: { toolId: id }
            });

            if (!tool) {
                throw new BadRequestException({
                    message: `Tool with ID ${id} not found`,
                    code: 'TOOL_NOT_FOUND'
                });
            }

            await this.toolsRepository.remove(tool);
            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to delete tool: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete tool',
                code: 'TOOL_DELETE_FAILED',
                errorSuperDetails: { ...error }
            });
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

    async getToolFields(input: OB1Tool.GetToolFieldsDto): Promise<OB1Tool.ServiceResponse<Partial<OB1AgentTools>[]>> {
        try {
            // Validate that all requested fields exist in the entity
            const validFields = new Set(Object.keys(new OB1AgentTools()));
            const invalidFields = input.fields.filter(field => !validFields.has(field));
            
            if (invalidFields.length > 0) {
                throw new BadRequestException({
                    message: `Invalid fields requested: ${invalidFields.join(', ')}`,
                    code: 'INVALID_FIELDS_REQUESTED'
                });
            }

            const fieldsToSelect = Array.from(new Set(['toolId', ...input.fields]));

            const selectObject = fieldsToSelect.reduce((acc, field) => ({
                ...acc,
                [field]: true
            }), {});

            const tool = await this.toolsRepository.find({
                where: { toolId: In(input.toolIds) },
                select: selectObject,
                relations: input.fields.includes('toolCategory') ? ['toolCategory'] : []
            });

            if (!tool) {
                throw new BadRequestException({
                    message: `Tool with ID ${input.toolIds} not found`,
                    code: 'TOOL_NOT_FOUND'
                });
            }

            return {
                success: true,
                data: tool,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch tool fields: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch tool fields',
                code: 'TOOL_FIELDS_FETCH_FAILED',
                errorSuperDetails: { ...error }
            });
        }
    }

}