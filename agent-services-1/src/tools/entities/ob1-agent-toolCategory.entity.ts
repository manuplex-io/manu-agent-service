// /src/tools/entities/ob1-agent-toolCategory.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Unique, Check } from 'typeorm';
import { OB1AgentTools } from './ob1-agent-tools.entity';

@Entity('ob1-agent-toolCategories')
@Unique(['toolCategoryName', 'toolCategoryCreatedByConsultantOrgShortName'])
export class OB1AgentToolCategory {

    @PrimaryGeneratedColumn('uuid')
    toolCategoryId: string;

    @Column({
        type: 'varchar',
        length: 16,
        comment: 'Name of the tool category in camelCase only',
    })
    @Check(`"toolCategoryName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    toolCategoryName: string;

    @Column({
        type: 'text',
        comment: 'Description of what tools in this category can do'
    })
    toolCategoryDescription: string;

    @OneToMany(() => OB1AgentTools, tool => tool.toolCategory)
    tools: OB1AgentTools[];

    @Column({
        type: 'varchar',
        comment: 'Consultant organization short name who created this tool in camelCase only',
    })
    @Check(`"toolCategoryCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    toolCategoryCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'uuid',
        comment: 'Person ID of the user who created this tool category',
    })
    toolCategoryCreatedByPersonId: string;
}