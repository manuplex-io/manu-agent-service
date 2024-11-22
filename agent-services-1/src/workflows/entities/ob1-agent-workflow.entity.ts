// src/workflows/entities/ob1-agent-workflow.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { OB1AgentActivity } from './ob1-agent-activity.entity';

export enum WorkflowStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    DEPRECATED = 'deprecated',
    DISABLED = 'disabled'
}

@Entity('ob1-agent-workflows')
export class OB1AgentWorkflow {
    @PrimaryGeneratedColumn("uuid")
    workflowId: string;

    @Column({
        type: 'varchar',
        length: 100,
        comment: 'Human-readable name of the workflow'
    })
    workflowName: string;

    @Column({
        type: 'text',
        comment: 'Description of what the workflow does'
    })
    workflowDescription: string;

    @Column({
        type: 'text',
        comment: 'The actual TypeScript workflow code'
    })
    workflowCode: string;

    @Column({
        type: 'enum',
        enum: WorkflowStatus,
        default: WorkflowStatus.DRAFT
    })
    workflowStatus: WorkflowStatus;

    @Column({
        type: 'jsonb',
        comment: 'Schema definition for the workflow input parameters',
        default: {}
    })
    workflowInputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'Schema definition for the workflow output format',
        default: {}
    })
    workflowOutputSchema: Record<string, any>;

    @ManyToMany(() => OB1AgentActivity)
    @JoinTable({
        name: 'ob1_workflow_activities',
        joinColumn: { name: 'workflowId', referencedColumnName: 'workflowId' },
        inverseJoinColumn: { name: 'activityId', referencedColumnName: 'activityId' }
    })
    workflowActivities: OB1AgentActivity[];

    @Column({
        type: 'integer',
        default: 0,
        comment: 'Number of times this workflow has been executed'
    })
    workflowExecutionCount: number;

    @Column({
        type: 'float',
        default: 0,
        comment: 'Average execution time in milliseconds'
    })
    workflowAvgExecutionTime: number;

    @CreateDateColumn()
    workflowCreatedAt: Date;

    @UpdateDateColumn()
    workflowUpdatedAt: Date;

    @Column({
        type: 'jsonb',
        default: {},
        comment: 'Additional metadata for the workflow'
    })
    workflowMetadata: Record<string, any>;
}