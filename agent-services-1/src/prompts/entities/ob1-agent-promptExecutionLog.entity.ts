import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { OB1AgentPrompts } from './ob1-agent-prompts.entity';

@Entity('ob1_agent_prompt_execution_logs')
export class OB1PromptExecutionLog {
    @PrimaryGeneratedColumn("uuid")
    executionId: string;

    @ManyToOne(() => OB1AgentPrompts)
    @JoinColumn({ name: 'promptId' })
    prompt: OB1AgentPrompts;

    @Column({ type: 'uuid' })
    promptId: string;

    @Column({
        type: 'jsonb',
        comment: 'System Prompt Variables used in this execution'
    })
    systemVariables: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'User Prompt Variables used in this execution'
    })
    userVariables: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'LLM configuration used'
    })
    llmConfig: Record<string, any>;

    @Column({
        type: 'text',
        comment: 'The final system prompt after variable interpolation'
    })
    processedSystemPrompt: string;

    @Column({
        type: 'text',
        comment: 'The user prompt'
    })
    processedUserPrompt: string;

    @Column({
        type: 'text',
        comment: 'The response from the LLM'
    })
    response: string;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Any tool calls made during execution'
    })
    toolCalls: Array<{
        name: string;
        arguments: Record<string, any>;
        output: any;
    }>;

    @Column({
        type: 'integer',
        comment: 'Response time in milliseconds'
    })
    responseTime: number;

    @Column({
        type: 'jsonb',
        comment: 'Token usage statistics'
    })
    tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };

    @CreateDateColumn()
    executedAt: Date;

    @Column({
        type: 'boolean',
        default: true,
        comment: 'Whether the execution was successful'
    })
    successful: boolean;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'Error message if execution failed'
    })
    errorMessage?: string;
}