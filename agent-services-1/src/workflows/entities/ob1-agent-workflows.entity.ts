// /src/workflows/entities/ob1-agent-workflows.entity.ts

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
    Unique,
    BeforeInsert,
    BeforeUpdate,
    DataSource,
    JoinColumn,
} from 'typeorm';
import { OB1AgentWorkflowCategory } from './ob1-agent-workflowCategory.entity';
import { OB1AgentWorkflowActivities } from './ob1-agent-workflowActivities.entity';
import { OB1Workflow } from '../interfaces/workflow.interface';
import { Logger } from '@nestjs/common';


@Entity('ob1-agent-workflows')
@Unique(['workflowCreatedByConsultantOrgShortName', 'workflowCategory', 'workflowName', 'workflowVersion'])
export class OB1AgentWorkflows {
    private static dataSource: DataSource;
    private readonly logger = new Logger(OB1AgentWorkflows.name);

    @BeforeInsert()
    @BeforeUpdate()
    async validateCategoryConsistency() {
        const category = await OB1AgentWorkflows.dataSource
            .getRepository(OB1AgentWorkflowCategory)
            .findOne({
                where: {
                    workflowCategoryId: this.workflowCategory.workflowCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid workflow category');
        }

        if (category.workflowCategoryCreatedByConsultantOrgShortName !== this.workflowCreatedByConsultantOrgShortName) {
            throw new Error(
                'The workflow category does not belong to the same consultant organization as the workflow.'
            );
        }
    }

    @BeforeInsert()
    async prepareForInsert() {
        const category = await OB1AgentWorkflows.dataSource
            .getRepository(OB1AgentWorkflowCategory)
            .findOne({
                where: {
                    workflowCategoryId: this.workflowCategory.workflowCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid workflow category');
        }

        // Calculate the workflow version by checking the latest version
        const latestWorkflow = await OB1AgentWorkflows.dataSource
            .getRepository(OB1AgentWorkflows)
            .createQueryBuilder('workflow')
            .where(
                'workflow.workflowName = :name AND workflow.workflowCategoryId = :categoryId AND workflow.workflowCreatedByConsultantOrgShortName = :org',
                {
                    name: this.workflowName,
                    categoryId: this.workflowCategory.workflowCategoryId,
                    org: this.workflowCreatedByConsultantOrgShortName,
                }
            )
            .orderBy('workflow.workflowVersion', 'DESC')
            .getOne();

        this.workflowVersion = (latestWorkflow?.workflowVersion || 0) + 1;
        //${this.workflowCreatedByConsultantOrgShortName}_
        // Generate workflowExternalName
        this.workflowExternalName = `${category.workflowCategoryName}_${this.workflowName}_v${this.workflowVersion}`
            .toLowerCase() // Ensure all lowercase
            .replace(/[^a-z0-9_]/g, '_'); // Replace invalid characters with underscores

        // Validate the final workflowExternalName
        if (!/^[a-z][a-z0-9_]*$/.test(this.workflowExternalName)) {
            throw new Error(
                `Generated workflowExternalName "${this.workflowExternalName}" does not conform to the required format`
            );
        }


        // Use the calculated version to generate the workflowExternalName
        //this.workflowExternalName = `${this.workflowCreatedByConsultantOrgShortName}_${category.workflowCategoryName}_${this.workflowName}_${this.workflowVersion}`;
        this.logger.debug(`Generated New workflowExternalName: ${this.workflowExternalName}`);

    }

    static setDataSource(dataSource: DataSource) {
        OB1AgentWorkflows.dataSource = dataSource;
    }

    @PrimaryGeneratedColumn('uuid')
    workflowId: string;

    @Column({
        type: 'varchar',
        length: 32,
        comment: 'Human-readable name of the workflow in camelCase only',
    })
    @Check(`"workflowName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    workflowName: string;

    @Column({
        type: 'text',
        comment: 'Description of what the workflow does',
    })
    workflowDescription: string;

    @Column({
        type: 'text',
        comment: 'Workflow code logic in string format',
    })
    workflowCode: string;

    //workflowMockCode
    @Column({
        type: 'text',
        comment: 'Mock code logic in string format',
    })
    workflowMockCode: string;

    @Column({
        type: 'jsonb',
        comment: 'Schema for the input parameters',
        default: {},
    })
    workflowInputSchema: Record<string, any>;

    @Column({
        type: 'jsonb',
        comment: 'Schema for the output parameters',
        default: {},
    })
    workflowOutputSchema: Record<string, any>;

    // List of external imports required by the workflow
    // this is to be avoided as Temporal workflows have very limited external imports
    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'List of external imports required by the workflow',
    })
    workflowImports: string[];

    @Column({
        type: 'enum',
        enum: OB1Workflow.WorkflowLang,
        default: OB1Workflow.WorkflowLang.TYPESCRIPT,
        comment: 'programming language of the workflow'
    })
    workflowLang: OB1Workflow.WorkflowLang;

    @Column({
        type: 'enum',
        enum: OB1Workflow.WorkflowType,
        default: OB1Workflow.WorkflowType.TEMPORAL,
        comment: 'type of workflow i.e use by temporal or lambda'
    })
    workflowType: OB1Workflow.WorkflowType;

    @Column({
        type: 'varchar',
        unique: true,
        comment: 'System-generated external name for the workflow',
    })
    workflowExternalName: string;  //snake case

    @OneToMany(() => OB1AgentWorkflowActivities, (workflowActivity) => workflowActivity.workflow)
    workflowActivities: OB1AgentWorkflowActivities[];

    @ManyToOne(() => OB1AgentWorkflowCategory, (category) => category.workflows, {
        onDelete: 'RESTRICT', // Prevent deletion of a category if it is referenced
        onUpdate: 'CASCADE',
    })
    @JoinColumn({ name: 'workflowCategoryId' }) // Explicitly set the foreign key column name
    workflowCategory: OB1AgentWorkflowCategory;

    @Column({
        type: 'uuid',
        comment: 'External person ID who created this workflow',
        nullable: true,
    })
    workflowCreatedByPersonId: string;

    @Column({
        type: 'varchar',
        comment: 'Consultant organization short name who created this workflow in camelCase only',
    })
    @Check(`"workflowCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    workflowCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'integer',
        default: 0,
        comment: 'Number of times this workflow has been executed',
    })
    workflowExecutionCount: number;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the workflow was created',
    })
    workflowCreatedAt: Date;

    @UpdateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'When the workflow was last updated',
    })
    workflowUpdatedAt: Date;

    @Column({
        type: 'integer',
        default: 1,
        comment: 'Version of the workflow',
    })
    workflowVersion: number;


    // should normally not be incremented as we are only adding new versions
    @VersionColumn({
        type: 'integer',
        default: 1,
        comment: 'Record version for optimistic locking',
    })
    workflowRecordVersion: number;
}
