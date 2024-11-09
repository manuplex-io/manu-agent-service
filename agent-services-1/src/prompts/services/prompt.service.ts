// src/prompts/services/prompt.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPrompts } from '../entities/ob1-agent-prompts.entity';
import { OB1PromptExecutionLog } from '../entities/ob1-agent-promptExecutionLog.entity';
import { LLMService } from '../../llms/services/llm.service';
import { LLMRequest, LLMResponse } from '../../llms/interfaces/llm.interfaces';
import { PromptStatus } from '../interfaces/prompt.interfaces';

@Injectable()
export class PromptService {
    private readonly logger = new Logger(PromptService.name);

    constructor(
        @InjectRepository(OB1AgentPrompts) private promptsRepo: Repository<OB1AgentPrompts>,
        @InjectRepository(OB1PromptExecutionLog) private executionLogRepo: Repository<OB1PromptExecutionLog>,
        private readonly llmService: LLMService
    ) { }

    async createPrompt(promptData: Partial<OB1AgentPrompts>): Promise<OB1AgentPrompts> {
        const prompt = this.promptsRepo.create(promptData);
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

    async listPrompts(filters: {
        status?: PromptStatus;
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

    private interpolateVariables(template: string, variables: Record<string, any>): string {
        return template.replace(/\${(\w+)}/g, (match, key) => {
            if (variables.hasOwnProperty(key)) {
                return variables[key];
            }
            throw new BadRequestException(`Missing required variable: ${key}`);
        });
    }

    async executePrompt(
        promptId: string,
        userPrompt: string,
        userVariables: Record<string, any> = {},
        systemVariables: Record<string, any> = {},
        llmConfigOverride: Record<string, any> = {}
    ): Promise<LLMResponse> {
        const startTime = Date.now();

        try {
            // Get the prompt
            const prompt = await this.getPrompt(promptId);
            if (prompt.promptStatus !== PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptId}`);
            }

            // Helper function to validate variables
            function validateVariables(variables: Record<string, any>, promptVariables: Record<string, any>, variableType: string) {
                for (const [key, config] of Object.entries(promptVariables)) {
                    // Check if required variable is missing
                    if (config.required && !variables.hasOwnProperty(key)) {
                        throw new BadRequestException(`Missing required ${variableType} prompt variable: ${key}`);
                    }

                    // Check if the type matches the expected type
                    const expectedType = config.type;
                    const actualType = typeof variables[key];
                    if (config.required && actualType !== expectedType) {
                        throw new BadRequestException(
                            `Invalid type for ${variableType} variable "${key}": expected ${expectedType}, but received ${actualType}`
                        );
                    }
                }
            }

            // Validate user and system variables
            validateVariables(userVariables, prompt.userPromptVariables, 'user');
            validateVariables(systemVariables, prompt.systemPromptVariables, 'system');

            // // System prompt Validate variables
            // for (const [key, config] of Object.entries(prompt.systemPromptVariables)) {
            //     if (config.required && !systemVariables.hasOwnProperty(key)) {
            //         throw new BadRequestException(`Missing system prompt required variable: ${key}`);
            //     }
            // }

            // // User prompt Validate variables
            // for (const [key, config] of Object.entries(prompt.userPromptVariables)) {
            //     if (config.required && !userVariables.hasOwnProperty(key)) {
            //         this.logger.error('key', key);
            //         this.logger.error('config', config);
            //         this.logger.error('userVariables', userVariables);
            //         throw new BadRequestException(`Missing user prompt required variable: ${key}`);
            //     }
            // }

            // Process the system prompt
            const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, systemVariables);

            // Process the user prompt
            const processedUserPrompt = this.interpolateVariables(userPrompt, userVariables);

            // Prepare LLM request
            const llmRequest: LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...llmConfigOverride,
                    tools: prompt.promptAvailableTools
                }
            };

            // Execute the request
            const response = await this.llmService.generateWithTools(llmRequest);

            // Log the execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId,
                systemVariables,
                userVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt,
                response: response.content,
                toolCalls: response.toolCalls,
                responseTime: executionTime,
                tokenUsage: response.usage,
                successful: true
            });

            // Update prompt statistics
            await this.updatePromptStats(promptId, executionTime);

            return response;

        } catch (error) {
            // Log failed execution
            await this.logExecution({
                promptId,
                systemVariables,
                userVariables,
                llmConfig: llmConfigOverride,
                processedSystemPrompt: '',
                processedUserPrompt: userPrompt || '',
                response: '',
                responseTime: Date.now() - startTime,
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                successful: false,
                errorMessage: error.message
            });

            throw error;
        }
    }

    async executewithoutUserPrompt(
        promptId: string,
        userVariables: Record<string, any> = {},
        systemVariables: Record<string, any> = {},
        llmConfigOverride: Record<string, any> = {}
    ): Promise<LLMResponse> {
        const startTime = Date.now();

        try {
            // Get the prompt
            const prompt = await this.getPrompt(promptId);
            if (prompt.promptStatus !== PromptStatus.ACTIVE) {
                throw new BadRequestException(`Prompt is not active: ${promptId}`);
            }

            // Helper function to validate variables
            function validateVariables(variables: Record<string, any>, promptVariables: Record<string, any>, variableType: string) {
                for (const [key, config] of Object.entries(promptVariables)) {
                    // Check if required variable is missing
                    if (config.required && !variables.hasOwnProperty(key)) {
                        throw new BadRequestException(`Missing required ${variableType} prompt variable: ${key}`);
                    }

                    // Check if the type matches the expected type
                    const expectedType = config.type;
                    const actualType = typeof variables[key];
                    if (config.required && actualType !== expectedType) {
                        throw new BadRequestException(
                            `Invalid type for ${variableType} variable "${key}": expected ${expectedType}, but received ${actualType}`
                        );
                    }
                }
            }

            // Validate user and system variables
            validateVariables(userVariables, prompt.userPromptVariables, 'user');
            validateVariables(systemVariables, prompt.systemPromptVariables, 'system');

            // // System prompt Validate variables
            // for (const [key, config] of Object.entries(prompt.systemPromptVariables)) {
            //     if (config.required && !systemVariables.hasOwnProperty(key)) {
            //         throw new BadRequestException(`Missing system prompt required variable: ${key}`);
            //     }
            // }

            // // User prompt Validate variables
            // for (const [key, config] of Object.entries(prompt.userPromptVariables)) {
            //     if (config.required && !userVariables.hasOwnProperty(key)) {
            //         this.logger.error('key', key);
            //         this.logger.error('config', config);
            //         this.logger.error('userVariables', userVariables);
            //         throw new BadRequestException(`Missing user prompt required variable: ${key}`);
            //     }
            // }

            // Process the system prompt
            const processedSystemPrompt = this.interpolateVariables(prompt.systemPrompt, systemVariables);

            // Process the user prompt
            const processedUserPrompt = this.interpolateVariables(prompt.userPrompt, userVariables);

            // Prepare LLM request
            const llmRequest: LLMRequest = {
                systemPrompt: processedSystemPrompt,
                userPrompt: processedUserPrompt,
                config: {
                    ...prompt.promptDefaultConfig,
                    ...llmConfigOverride,
                    tools: prompt.promptAvailableTools
                }
            };

            // Execute the request
            const response = await this.llmService.generateWithTools(llmRequest);

            // Log the execution
            const executionTime = Date.now() - startTime;
            await this.logExecution({
                promptId,
                systemVariables,
                userVariables,
                llmConfig: llmRequest.config,
                processedSystemPrompt,
                processedUserPrompt,
                response: response.content,
                toolCalls: response.toolCalls,
                responseTime: executionTime,
                tokenUsage: response.usage,
                successful: true
            });

            // Update prompt statistics
            await this.updatePromptStats(promptId, executionTime);

            return response;

        } catch (error) {
            // Log failed execution
            await this.logExecution({
                promptId,
                systemVariables,
                userVariables,
                llmConfig: llmConfigOverride,
                processedSystemPrompt: '',
                processedUserPrompt: '',
                response: '',
                responseTime: Date.now() - startTime,
                tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                successful: false,
                errorMessage: error.message
            });

            throw error;
        }
    }

    private async logExecution(logData: Partial<OB1PromptExecutionLog>): Promise<void> {
        const log = this.executionLogRepo.create(logData);
        await this.executionLogRepo.save(log);
    }

    private async updatePromptStats(promptId: string, executionTime: number): Promise<void> {
        const prompt = await this.getPrompt(promptId);

        // Update execution count and average response time
        const newCount = prompt.promptExecutionCount + 1;
        const newAvgTime = ((prompt.promptAvgResponseTime * prompt.promptExecutionCount) + executionTime) / newCount;

        await this.promptsRepo.update(promptId, {
            promptExecutionCount: newCount,
            promptAvgResponseTime: newAvgTime
        });
    }

    async getExecutionLogs(
        promptId: string,
        filters: {
            startDate?: Date;
            endDate?: Date;
            successful?: boolean;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ logs: OB1PromptExecutionLog[]; total: number }> {
        const query = this.executionLogRepo.createQueryBuilder('log')
            .where('log.promptId = :promptId', { promptId });

        if (filters.startDate) {
            query.andWhere('log.executedAt >= :startDate', { startDate: filters.startDate });
        }

        if (filters.endDate) {
            query.andWhere('log.executedAt <= :endDate', { endDate: filters.endDate });
        }

        if (filters.successful !== undefined) {
            query.andWhere('log.successful = :successful', { successful: filters.successful });
        }

        const total = await query.getCount();

        query.orderBy('log.executedAt', 'DESC')
            .limit(filters.limit || 10)
            .offset(filters.offset || 0);

        const logs = await query.getMany();

        return { logs, total };
    }
}