import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { OB1AgentWorkflows } from './ob1-agent-workflows.entity';

@Entity('ob1-agent-workflowExecutions')
export class OB1AgentWorkflowExecutionLog {
    @PrimaryGeneratedColumn('uuid')
    workflowExecutionId: string;

    @ManyToOne(() => OB1AgentWorkflows)
    workflow: OB1AgentWorkflows;

    @Column({
        type: 'uuid',
        comment: 'External person ID who executed the workflow',
    })
    workflowExecutedBy: string;

    @Column({
        type: 'uuid',
        comment: 'External organization ID for whom the workflow was executed',
    })
    workflowExecutedFor: string;

    @Column({
        type: 'jsonb',
        comment: 'Input parameters for the workflow execution',
    })
    workflowInput: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Output from the workflow execution',
    })
    workflowOutput?: Record<string, any>;

    @Column({
        type: 'boolean',
        comment: 'Whether the workflow execution was successful',
    })
    workflowSuccess: boolean;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'Error message if the execution failed',
    })
    workflowErrorMessage?: string;

    @Column({
        type: 'integer',
        comment: 'Execution time in milliseconds',
    })
    workflowExecutionTime: number;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the workflow was executed',
    })
    workflowExecutedAt: Date;
}
