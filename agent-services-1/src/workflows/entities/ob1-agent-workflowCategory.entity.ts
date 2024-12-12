// /src/workflows/entities/ob1-agent-workflowCategory.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Check, Unique } from 'typeorm';
import { OB1AgentWorkflows } from './ob1-agent-workflows.entity';

@Entity('ob1-agent-workflowCategories')
@Unique(['workflowCategoryName', 'workflowCategoryCreatedByConsultantOrgShortName'])
export class OB1AgentWorkflowCategory {
    @PrimaryGeneratedColumn('uuid')
    workflowCategoryId: string;

    @Column({
        type: 'varchar',
        length: 16,
        comment: 'Name of the workflow category (e.g., "DataProcessing", "ETL") in camelCase only',
    })
    @Check(`"workflowCategoryName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    workflowCategoryName: string;

    @Column({
        type: 'text',
        comment: 'Description of workflows in this category',
    })
    workflowCategoryDescription: string;

    @OneToMany(() => OB1AgentWorkflows, (workflow) => workflow.workflowCategory)
    workflows: OB1AgentWorkflows[];

    @Column({
        type: 'varchar',
        comment: 'Consultant organization short name who created this workflow category in camelCase only',
    })
    @Check(`"workflowCategoryCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    workflowCategoryCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'uuid',
        comment: 'Person ID of the user who created this workflow category',
    })
    workflowCategoryCreatedByPersonId: string;
}
