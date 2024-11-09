import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm';

import { PromptStatus, PromptCategory } from '../interfaces/prompt.interfaces';
import { LLMProvider, AnthropicModels, OpenAIModels, Tool } from '../../llms/interfaces/llm.interfaces';

@Entity('ob1_agent_prompts')
export class OB1AgentPrompts {
    @PrimaryGeneratedColumn("uuid", {
        comment: 'Auto-generated unique universal Id for the prompt'
    })
    promptId: string;

    @Column({
        type: 'varchar',
        length: 100,
        comment: 'Human-readable name of the prompt'
    })
    promptName: string;

    @Column({
        type: 'text',
        comment: 'Description of what the prompt does'
    })
    promptDescription: string;

    @Column({
        type: 'enum',
        enum: PromptStatus,
        default: PromptStatus.DRAFT,
        comment: 'Current status of the prompt'
    })
    promptStatus: PromptStatus;

    @Column({
        type: 'enum',
        enum: PromptCategory,
        default: PromptCategory.GENERAL,
        comment: 'Category of the prompt'
    })
    promptCategory: PromptCategory;

    @Column({
        type: 'text',
        comment: 'The system prompt template'
    })
    systemPrompt: string;

    //optional user prompt
    @Column({
        type: 'text',
        nullable: true,
        comment: 'The user prompt template'
    })
    userPrompt: string;

    @Column({
        type: 'jsonb',
        comment: 'Variables required for the prompt template',
        default: {}
    })
    systemPromptVariables: Record<string, {
        type: string;
        description: string;
        required: boolean;
        defaultValue?: any;
    }>;

    @Column({
        type: 'jsonb',
        comment: 'Variables required for the prompt template',
        default: {}
    })
    userPromptVariables: Record<string, {
        type: string;
        description: string;
        required: boolean;
        defaultValue?: any;
    }>;

    @Column({
        type: 'jsonb',
        comment: 'Default configuration for LLM',
        default: {}
    })
    promptDefaultConfig: {
        provider: LLMProvider;
        model: AnthropicModels | OpenAIModels;
        temperature?: number;
        maxTokens?: number;
    };

    @Column({
        type: 'text',
        array: true,
        default: '{}',
        comment: 'IDs of tools that should be available with this prompt'
    })
    promptAvailableTools: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({
        type: 'integer',
        default: 0,
        comment: 'Number of times this prompt has been executed'
    })
    promptExecutionCount: number;

    @Column({
        type: 'float',
        default: 0,
        comment: 'Average response time in milliseconds'
    })
    promptAvgResponseTime: number;
}
