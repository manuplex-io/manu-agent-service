import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { OB1AgentTools } from './ob1-agent-tools.entity';

@Entity('ob1-agent-toolExecutionLogs')
export class OB1ToolExecutionLog {
    @PrimaryGeneratedColumn('uuid')
    executionLogId: string;

    @ManyToOne(() => OB1AgentTools)
    tool: OB1AgentTools;

    @Column({
        type: 'varchar',
        length: 100,
        comment: 'ID of the agent that used the tool'
    })
    agentId: string;

    @Column({
        type: 'jsonb',
        comment: 'Input parameters used for the execution'
    })
    input: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Output returned from the tool'
    })
    output?: Record<string, any>;

    @Column({
        type: 'boolean',
        comment: 'Whether the execution was successful'
    })
    success: boolean;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'Error message if execution failed'
    })
    errorMessage?: string;

    @Column({
        type: 'integer',
        comment: 'Execution time in milliseconds'
    })
    executionTime: number;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the execution occurred'
    })
    executedAt: Date;
}