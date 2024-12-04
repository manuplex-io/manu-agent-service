// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1AgentPromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { LLMV2Service } from '../../llms/services/llmV2.service';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { OB1Prompt } from '../interfaces/prompt.interface';

@Injectable()
export class PromptManagementV1Service {
    private readonly logger = new Logger(PromptManagementV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1AgentPromptExecutionLog) private executionLogRepo: Repository<OB1AgentPromptExecutionLog>,
        private readonly llmV2Service: LLMV2Service
    ) { }

    async createPrompt(promptData: OB1Prompt.CreatePrompt): Promise<OB1AgentPrompts> {
        const prompt = this.promptsRepo.create({
            ...promptData,
            promptCreatedByConsultantOrgShortName: promptData.consultantOrgShortName,
            promptCreatedByPersonId: promptData.personId,
        }
        );
        return await this.promptsRepo.save(prompt);
    }

    async updatePrompt(promptId: string, promptData: Partial<OB1AgentPrompts>): Promise<OB1AgentPrompts> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }

        Object.assign(prompt, promptData);
        return await this.promptsRepo.save(prompt);
    }

    async getPrompt(promptId: string): Promise<OB1AgentPrompts> {
        const prompt = await this.promptsRepo.findOne({ where: { promptId } });
        if (!prompt) {
            throw new NotFoundException(`Prompt with ID ${promptId} not found`);
        }
        return prompt;
    }

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

    async listPrompts(filters: {
        status?: OB1Prompt.PromptStatus;
        category?: string;
        search?: string;
    } = {}): Promise<OB1AgentPrompts[]> {
        const query = this.promptsRepo.createQueryBuilder('prompt');

        if (filters.status) {
            query.andWhere('prompt.promptStatus = :status', { status: filters.status });
        }

        if (filters.category) {
            query.andWhere('prompt.category = :category', { category: filters.category });
        }

        if (filters.search) {
            query.andWhere(
                '(prompt.promptName ILIKE :search OR prompt.promptDescription ILIKE :search)',
                { search: `%${filters.search}%` }
            );
        }

        return await query.getMany();
    }

}