
// src/workflows/entities/ob1-agent-activity.entity.ts
import { OB1AgentTools } from '../../tools/entities/ob1-agent-tools.entity';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, VersionColumn, ManyToOne } from 'typeorm';


export enum ActivityType {
    TOOL_BASED = 'tool_based',
    TYPESCRIPT_CODE = 'typescript_code',
    CUSTOM_LOGIC = 'custom_logic'
}

export enum ActivityStatus {
    ACTIVE = 'active',
    DEPRECATED = 'deprecated',
    TESTING = 'testing',
    DISABLED = 'disabled'
}

@Entity('ob1-agent-activities')
export class OB1AgentActivity {
    @PrimaryGeneratedColumn("uuid")
    activityId: string;

    @Column({
        type: 'varchar',
        length: 100
    })
    activityName: string;

    @Column({
        type: 'text'
    })
    activityDescription: string;

    @Column({
        type: 'enum',
        enum: ActivityType,
        default: ActivityType.CUSTOM_LOGIC
    })
    activityType: ActivityType;

    @Column({
        type: 'enum',
        enum: ActivityStatus,
        default: ActivityStatus.TESTING
    })
    activityStatus: ActivityStatus;

    @ManyToOne(() => OB1AgentTools, { nullable: true })
    tool?: OB1AgentTools;

    @Column({
        type: 'text',
        nullable: true,
        comment: 'TypeScript code for the activity'
    })
    activityCode?: string;

    @Column({
        type: 'jsonb',
        comment: 'Schema definition for the activity input parameters',
        default: {}
    })
    activityInputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'Schema definition for the activity output format',
        default: {}
    })
    activityOutputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        default: {}
    })
    activityConfig: Record<string, any>;

    @Column({
        type: 'jsonb',
        default: {
            initialInterval: 1,
            backoffCoefficient: 2,
            maximumAttempts: 3,
            maximumInterval: 100
        }
    })
    activityRetryPolicy: {
        initialInterval: number;
        backoffCoefficient: number;
        maximumAttempts: number;
        maximumInterval: number;
    };

    @Column({
        type: 'integer',
        default: 0
    })
    activityExecutionCount: number;

    @Column({
        type: 'float',
        default: 0
    })
    activityAvgExecutionTime: number;

    @CreateDateColumn()
    activityCreatedAt: Date;

    @UpdateDateColumn()
    activityUpdatedAt: Date;

    @VersionColumn()
    activityVersion: number;
}
