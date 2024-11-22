import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { OB1AgentTools } from './ob1-agent-tools.entity';

@Entity('ob1-agent-toolCategories')
export class OB1ToolCategory {
    @PrimaryGeneratedColumn('uuid')
    toolCategoryId: string;

    @Column({
        type: 'varchar',
        length: 100,
        unique: true,
        comment: 'Name of the tool category (e.g., "Python Scripts", "API Calls", "Data Processing")'
    })
    toolCategoryName: string;

    @Column({
        type: 'text',
        comment: 'Description of what tools in this category can do'
    })
    toolCategoryDescription: string;

    @OneToMany(() => OB1AgentTools, tool => tool.toolCategory)
    tools: OB1AgentTools[];
}