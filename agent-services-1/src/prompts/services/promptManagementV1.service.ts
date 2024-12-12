// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1AgentPromptCategory } from '../entities/ob1-agent-promptCategory.entity';
import { OB1AgentPromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { LLMV2Service } from '../../llms/services/llmV2.service';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { OB1Prompt } from '../interfaces/prompt.interface';

@Injectable()
export class PromptManagementV1Service {
    private readonly logger = new Logger(PromptManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1AgentPromptCategory) private promptCategoryRepository: Repository<OB1AgentPromptCategory>,
        @InjectRepository(OB1AgentPromptExecutionLog) private executionLogRepo: Repository<OB1AgentPromptExecutionLog>,
    ) { }

    async createPrompt(promptData: OB1Prompt.CreatePrompt): Promise<any> {
        try {
            const category = await this.promptCategoryRepository.findOne({
                where: {
                    promptCategoryId: promptData.promptCategoryId,
                    promptCategoryCreatedByConsultantOrgShortName: promptData.consultantOrgShortName,
                },
            });

            if (promptData.promptCategoryId && !category) {
                throw new BadRequestException({
                    message: 'Category not found',
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            this.logger.log(`Creating prompt: ${JSON.stringify(promptData, null, 2)}`);
            this.logger.log(`Category: ${JSON.stringify(category, null, 2)}`);

            const prompt = this.promptsRepo.create({
                ...promptData,
                promptCategory: category,
                promptStatus: promptData.promptStatus || OB1Prompt.PromptStatus.DRAFT,
                promptCreatedByConsultantOrgShortName: promptData.consultantOrgShortName,
                promptCreatedByPersonId: promptData.personId,
            });

            const savedPrompt = await this.promptsRepo.save(prompt);
            return {
                success: true,
                data: this.mapToPromptResponse(savedPrompt),
            };
        } catch (error) {
            throw new BadRequestException({
                message: 'Failed to create prompt',
                errorSuperDetails: { ...error },
            });

        }
    }

    async updatePrompt(promptId: string, promptData: Partial<OB1AgentPrompts>): Promise<OB1AgentPrompts> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }

        Object.assign(prompt, promptData);
        return await this.promptsRepo.save(prompt);
    }

    // async getPrompt(promptId: string): Promise<OB1AgentPrompts> {
    //     const prompt = await this.promptsRepo.findOne({ where: { promptId } });
    //     if (!prompt) {
    //         throw new NotFoundException(`Prompt with ID ${promptId} not found`);
    //     }
    //     return prompt;
    // }

    async deletePrompt(promptId: string): Promise<any> {
        try {
            const prompt = await this.promptsRepo.findOne({ where: { promptId } });

            if (!prompt) {
                return {
                    success: false,
                    error: {
                        code: 'PROMPT_NOT_FOUND',
                        message: `Prompt with ID ${promptId} not found`,
                    },
                };
            }

            await this.promptsRepo.remove(prompt);
            return {
                success: true,
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'PROMPT_DELETE_FAILED',
                    message: 'Failed to delete prompt',
                    details: { error: error.message },
                },
            };
        }
    }


    async getPrompts(
        filters: OB1Prompt.WorkflowQueryParams
    ):Promise<OB1Prompt.ServiceResponse<OB1Prompt.PaginatedResponse<OB1Prompt.PromptResponse>>> {
        try{
            const { consultantOrgShortName, status, category, search, page = 1, limit = 10 } = filters;
            const query = this.promptsRepo
                .createQueryBuilder('prompt')
                .leftJoinAndSelect('prompt.promptCategory', 'promptCategory')
                .where('prompt.promptCreatedByConsultantOrgShortName = :consultantOrgShortName', { 
                    consultantOrgShortName 
                });

            if (status) {
                query.andWhere('prompt.promptStatus = :status', { status: status });
            }
    
            if (category) {
                query.andWhere('prompt.category = :category', { category: category });
            }
    
            if (search) {
                query.andWhere(
                    '(prompt.promptName ILIKE :search OR prompt.promptDescription ILIKE :search)',
                    { search: `%${search}%` }
                );
            }

            const total = await query.getCount();
            const prompts = await query                
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();
    
            return {
                success: true,
                data: {
                    items: prompts.map(this.mapToPromptResponse),
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            }
        } catch (error){
            this.logger.error(`Failed to fetch prompts: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch prompts',
                errorSuperDetails: { ...error },
            });
        }
    }

    async getPrompt(promptId: string): Promise<OB1Prompt.ServiceResponse<OB1Prompt.PromptResponse>> {
        try{
            const prompt = await this.promptsRepo.findOne({ where: { promptId } });
            if (!prompt) {
                throw new NotFoundException(`Prompt with ID ${promptId} not found`);
            }
            return {
                success: true,
                data: this.mapToPromptResponse(prompt),
            };
        }catch (error){
            this.logger.error(`Failed to fetch prompt: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch prompt',
                errorSuperDetails: { ...error },
            });
        }

    }

    private mapToPromptResponse(prompt: OB1AgentPrompts): OB1Prompt.PromptResponse {
        return {
            promptId: prompt.promptId,
            promptName: prompt.promptName,
            promptExternalName: prompt.promptExternalName,
            promptDescription: prompt.promptDescription,
            promptCategory: prompt.promptCategory
                ? {
                      promptCategoryId: prompt.promptCategory.promptCategoryId,
                      promptCategoryName: prompt.promptCategory.promptCategoryName,
                      promptCategoryCreatedByConsultantOrgShortName:
                          prompt.promptCategory.promptCategoryCreatedByConsultantOrgShortName,
                  }
                : undefined,
            promptStatus: prompt.promptStatus,
            promptVersion: prompt.promptVersion,
            promptCreatedByConsultantOrgShortName: prompt.promptCreatedByConsultantOrgShortName,
            promptCreatedByPersonId: prompt.promptCreatedByPersonId,
            systemPrompt: prompt.systemPrompt,
            userPrompt: prompt.userPrompt, // Can be undefined based on the interface
            systemPromptVariables: prompt.systemPromptVariables,
            userPromptVariables: prompt.userPromptVariables,
            promptDefaultConfig: prompt.promptDefaultConfig,
            promptAvailableTools: prompt.promptAvailableTools,
            promptToolChoice: prompt.promptToolChoice, // Optional as per the interface
            promptCreatedAt: prompt.promptCreatedAt,
            promptUpdatedAt: prompt.promptUpdatedAt,
            promptExecutionCount: prompt.promptExecutionCount,
            promptResponseFormat: prompt.promptResponseFormat, // Optional as per the interface
            promptAvgResponseTime: prompt.promptAvgResponseTime,
        };
    }
}