// /src/activitys/entities/ob1-agent-activitys.entity.ts

import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    VersionColumn,
    ManyToOne,
    OneToMany,
    Check,
    BeforeInsert,
    Unique,
    DataSource,
    BeforeUpdate,
    JoinColumn,
} from 'typeorm';
import { OB1AgentActivityCategory } from './ob1-agent-activityCategory.entity';
import { OB1AgentWorkflowActivities } from '../../workflows/entities/ob1-agent-workflowActivities.entity';
import { OB1Activity } from '../interfaces/activity.interface';
import { Logger } from '@nestjs/common';

@Entity('ob1-agent-activities')
@Unique(['activityCreatedByConsultantOrgShortName', 'activityCategory', 'activityName', 'activityVersion'])
export class OB1AgentActivities {
    private readonly logger = new Logger(OB1AgentActivities.name);


    private static dataSource: DataSource;

    @BeforeInsert()
    @BeforeUpdate()
    async validateCategoryConsistency() {
        const category = await OB1AgentActivities.dataSource
            .getRepository(OB1AgentActivityCategory)
            .findOne({
                where: {
                    activityCategoryId: this.activityCategory.activityCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid activity category');
        }

        if (category.activityCategoryCreatedByConsultantOrgShortName !== this.activityCreatedByConsultantOrgShortName) {
            throw new Error(
                'The activity category does not belong to the same consultant organization as the activity.'
            );
        }
    }

    @BeforeInsert()
    async prepareForInsert() {
        const category = await OB1AgentActivities.dataSource
            .getRepository(OB1AgentActivityCategory)
            .findOne({
                where: {
                    activityCategoryId: this.activityCategory.activityCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid activity category');
        }

        // Calculate the activity version by checking the latest version
        const latestActivity = await OB1AgentActivities.dataSource
            .getRepository(OB1AgentActivities)
            .createQueryBuilder('activity')
            .where(
                'activity.activityName = :name AND activity.activityCategoryId = :categoryId AND activity.activityCreatedByConsultantOrgShortName = :org',
                {
                    name: this.activityName,
                    categoryId: this.activityCategory.activityCategoryId,
                    org: this.activityCreatedByConsultantOrgShortName,
                }
            )
            .orderBy('activity.activityVersion', 'DESC')
            .getOne();

        this.activityVersion = (latestActivity?.activityVersion || 0) + 1;
        //${this.activityCreatedByConsultantOrgShortName}_
        // Generate activityExternalName
        this.activityExternalName = `${category.activityCategoryName}_${this.activityName}_v${this.activityVersion}`
            .toLowerCase() // Ensure all lowercase
            .replace(/[^a-z0-9_]/g, '_'); // Replace invalid characters with underscores

        // Validate the final activityExternalName
        if (!/^[a-z][a-z0-9_]*$/.test(this.activityExternalName)) {
            throw new Error(
                `Generated activityExternalName "${this.activityExternalName}" does not conform to the required format`
            );
        }


        // Use the calculated version to generate the activityExternalName
        //this.activityExternalName = `${this.activityCreatedByConsultantOrgShortName}_${category.activityCategoryName}_${this.activityName}_${this.activityVersion}`;
        this.logger.debug(`Generated New activityExternalName: ${this.activityExternalName}`);

    }


    static setDataSource(dataSource: DataSource) {
        OB1AgentActivities.dataSource = dataSource;
    }


    @PrimaryGeneratedColumn('uuid')
    activityId: string;

    @Column({
        type: 'varchar',
        length: 32,
        //default: 'missingActivityName',
        comment: 'Human-readable name of the activity in camelCase only',
    })
    @Check(`"activityName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    activityName: string;

    @Column({
        type: 'text',
        comment: 'Description of what the activity does',
    })
    activityDescription: string;

    @Column({
        type: 'text',
        comment: 'Activity code logic in string format',
    })
    activityCode: string;

    //activityMockCode
    @Column({
        type: 'text',
        comment: 'Mock code for the activity',
    })
    activityMockCode: string;

    @Column({
        type: 'jsonb',
        comment: 'Schema for the input parameters',
        default: {},
    })
    activityInputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'Schema for the ENV input parameters',
        default: {},
    })
    activityENVInputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'Schema for the output parameters',
        default: {},
    })
    activityOutputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'List of external imports required by the activity',
    })
    activityImports: string[];

    @OneToMany(() => OB1AgentWorkflowActivities, (workflowActivity) => workflowActivity.activity)
    activityWorkflows: OB1AgentWorkflowActivities[];

    @Column({
        type: 'uuid',
        comment: 'External person ID who created this activity',
        nullable: true,
    })
    activityCreatedByPersonId: string;

    @Column({
        type: 'varchar',
        comment: 'Consultant organization short name who created this activity in camelCase only',
    })
    @Check(`"activityCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`) //camelCase
    activityCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'enum',
        enum: OB1Activity.ActivityLang,
        default: OB1Activity.ActivityLang.TYPESCRIPT,
        comment: 'programming language of the activity'
    })
    activityLang: OB1Activity.ActivityLang;

    @Column({
        type: 'enum',
        enum: OB1Activity.ActivityType,
        default: OB1Activity.ActivityType.TEMPORAL,
        comment: 'type of activity i.e use by temporal or lambda'
    })
    activityType: OB1Activity.ActivityType;

    @Column({
        type: 'varchar',
        unique: true,
        comment: 'System-generated external name for the activity',
    })
    activityExternalName: string;
    //@Check(`"activityExternalName" ~ '^[a-z][a-z0-9_]*$'`)  //snake_case (did not work so put it in the before Hook)


    @ManyToOne(() => OB1AgentActivityCategory, (category) => category.activities, {
        onDelete: 'RESTRICT', // Prevent deletion of a category if it is referenced
        onUpdate: 'CASCADE',
    })
    @JoinColumn({ name: 'activityCategoryId' }) // Explicitly set the foreign key column name
    activityCategory: OB1AgentActivityCategory;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the activity was created',
    })
    activityCreatedAt: Date;

    @UpdateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the activity was last updated',
    })
    activityUpdatedAt: Date;

    @Column(
        {
            type: 'integer',
            default: 1,
            comment: 'Version of the activity',
        }
    )
    activityVersion: number;

    //this should ideally never trigger as the update activity actually creates a new one
    @VersionColumn({
        type: 'integer',
        default: 1,
        comment: 'Record version for optimistic locking',
    })
    activityRecordVersion: number;
}

