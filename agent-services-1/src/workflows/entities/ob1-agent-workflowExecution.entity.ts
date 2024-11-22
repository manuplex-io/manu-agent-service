
// src/entities/ob1-agent-workflowExecution.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { OB1AgentWorkflow } from './ob1-agent-workflow.entity';

@Entity('ob1-agent-workflow-executions')
export class OB1WorkflowExecution {
    @PrimaryGeneratedColumn("uuid")
    executionId: string;

    @ManyToOne(() => OB1AgentWorkflow)
    workflow: OB1AgentWorkflow;

    @Column({
        type: 'jsonb'
    })
    input: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true
    })
    output?: Record<string, any>;

    @Column({
        type: 'varchar'
    })
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

    @Column({
        type: 'jsonb'
    })
    activityExecutions: Array<{
        activityId: string;
        startTime: Date;
        endTime?: Date;
        status: string;
        input: Record<string, any>;
        output?: Record<string, any>;
        error?: string;
    }>;

    @CreateDateColumn()
    startTime: Date;

    @Column({
        type: 'timestamptz',
        nullable: true
    })
    endTime?: Date;

    @Column({
        type: 'text',
        nullable: true
    })
    error?: string;
}




