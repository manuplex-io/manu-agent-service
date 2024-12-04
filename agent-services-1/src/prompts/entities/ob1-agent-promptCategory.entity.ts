// /src/prompts/entities/ob1-agent-promptCategory.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Unique, Check } from 'typeorm';
import { OB1AgentPrompts } from './ob1-agent-prompts.entity';

@Entity('ob1-agent-promptCategories')
@Unique(['promptCategoryName', 'promptCategoryCreatedByConsultantOrgShortName'])
export class OB1AgentPromptCategory {

    @PrimaryGeneratedColumn('uuid')
    promptCategoryId: string;

    @Column({
        type: 'varchar',
        length: 16,
        comment: 'Name of the prompt category in camelCase only',
    })
    @Check(`"promptCategoryName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    promptCategoryName: string;

    @Column({
        type: 'text',
        comment: 'Description of what prompts in this category can do'
    })
    promptCategoryDescription: string;

    @OneToMany(() => OB1AgentPrompts, prompt => prompt.promptCategory)
    prompts: OB1AgentPrompts[];

    @Column({
        type: 'varchar',
        comment: 'Consultant organization short name who created this prompt in camelCase only',
    })
    @Check(`"promptCategoryCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    promptCategoryCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'uuid',
        comment: 'Person ID of the user who created this prompt category',
    })
    promptCategoryCreatedByPersonId: string;
}