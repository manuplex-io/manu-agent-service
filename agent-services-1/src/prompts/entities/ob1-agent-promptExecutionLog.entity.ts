import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { OB1AgentPrompts } from './ob1-agent-prompts.entity';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';

@Entity('ob1-agent-promptExecutionLogs')
export class OB1AgentPromptExecutionLog {
    @PrimaryGeneratedColumn("uuid")
    executionId: string;

    @ManyToOne(() => OB1AgentPrompts)
    @JoinColumn({ name: 'promptId' })
    prompt: OB1AgentPrompts;

    @Column({ type: 'uuid' })
    promptId: string;

    @Column({
        type: 'jsonb',
        comment: 'System Prompt Variables used in this execution',
        nullable: true
    })
    systemVariables: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'User Prompt Variables used in this execution',
        nullable: true
    })
    userVariables: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'LLM configuration used',
        nullable: true
    })
    llmConfig: Record<string, any>;

    @Column({
        type: 'text',
        comment: 'The final system prompt after variable interpolation',
        nullable: true
    })
    processedSystemPrompt: string;

    @Column({
        type: 'text',
        comment: 'The user prompt',
        nullable: true
    })
    processedUserPrompt: string;

    @Column({
        type: 'text',
        comment: 'The response from the LLM',
        nullable: true
    })
    response: string;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Any tool calls made during execution'
    })
    toolCalls: Array<OB1Tool.ToolCallLog>;


    @Column({
        type: 'integer',
        comment: 'Response time in milliseconds',
        nullable: true
    })
    responseTime: number;

    @Column({
        type: 'jsonb',
        comment: 'Token usage statistics',
        nullable: true
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

    //tracing dictionary input
    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Tracing input from the request'
    })
    tracing?: Record<string, any>;

    //metadata dictionary input
    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Metadata input from the request'
    })
    requestMetadata?: Record<string, any>;
}