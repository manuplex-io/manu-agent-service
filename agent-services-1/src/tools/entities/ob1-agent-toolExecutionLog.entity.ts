import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { OB1AgentTools } from './ob1-agent-tools.entity';

@Entity('ob1-agent-toolExecutionLogs')
export class OB1ToolExecutionLog {
    @PrimaryGeneratedColumn('uuid')
    toolExecutionLogId: string;

    @ManyToOne(() => OB1AgentTools)
    tool: OB1AgentTools;

    @Column({
        type: 'varchar',
        length: 100,
        comment: 'ID of the Service that used the tool'
    })
    requestingServiceId: string;

    @Column({
        type: 'jsonb',
        comment: 'Input parameters used for the execution'
    })
    toolInput: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Output returned from the tool'
    })
    toolOutput?: Record<string, any>;

    @Column({
        type: 'boolean',
        comment: 'Whether the execution was successful'
    })
    toolSuccess: boolean;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'Error message if execution failed'
    })
    toolErrorMessage?: string;

    @Column({
        type: 'integer',
        comment: 'Execution time in milliseconds'
    })
    toolExecutionTime: number;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the execution occurred'
    })
    toolExecutedAt: Date;
}