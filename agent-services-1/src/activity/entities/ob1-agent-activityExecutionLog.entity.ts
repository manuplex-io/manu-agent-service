import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { OB1AgentActivities } from './ob1-agent-activities.entity';

@Entity('ob1-agent-activityExecutions')
export class OB1AgentActivityExecution {
    @PrimaryGeneratedColumn('uuid')
    activityExecutionId: string;

    @ManyToOne(() => OB1AgentActivities)
    activity: OB1AgentActivities;

    @Column({
        type: 'uuid',
        comment: 'External person ID who executed the activity',
    })
    activityExecutedBy: string;

    @Column({
        type: 'uuid',
        comment: 'External organization ID for whom the activity was executed',
    })
    activityExecutedFor: string;

    @Column({
        type: 'jsonb',
        comment: 'Input parameters for the activity execution',
    })
    activityInput: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Output returned from the activity execution',
    })
    activityOutput?: Record<string, any>;

    @Column({
        type: 'boolean',
        comment: 'Whether the activity execution was successful',
    })
    activitySuccess: boolean;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'Error message if execution failed',
    })
    activityErrorMessage?: string;

    @Column({
        type: 'integer',
        comment: 'Execution time in milliseconds',
    })
    activityExecutionTime: number;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the activity was executed',
    })
    activityExecutedAt: Date;
}
