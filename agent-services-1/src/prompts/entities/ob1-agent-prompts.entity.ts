import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Check,
    BeforeInsert,
    BeforeUpdate,
    DataSource,
    ManyToOne,
    Unique,
    JoinColumn
} from 'typeorm';

import { OB1Prompt } from '../interfaces/prompt.interface';
import { OB1LLM } from '../../llms/interfaces/llmV2.interfaces';
import { Logger } from '@nestjs/common';
import { OB1AgentPromptCategory } from './ob1-agent-promptCategory.entity';

@Entity('ob1-agent-prompts')
@Unique(['promptCreatedByConsultantOrgShortName', 'promptCategory', 'promptName', 'promptVersion'])
export class OB1AgentPrompts {

    private readonly logger = new Logger(OB1AgentPrompts.name);

    private static dataSource: DataSource;

    @BeforeInsert()
    @BeforeUpdate()
    async validateCategoryConsistency() {
        const category = await OB1AgentPrompts.dataSource
            .getRepository(OB1AgentPromptCategory)
            .findOne({
                where: {
                    promptCategoryId: this.promptCategory.promptCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid prompt category');
        }

        if (category.promptCategoryCreatedByConsultantOrgShortName !== this.promptCreatedByConsultantOrgShortName) {
            throw new Error(
                'The prompt category does not belong to the same consultant organization as the prompt.'
            );
        }
    }

    @BeforeInsert()
    async prepareForInsert() {
        const category = await OB1AgentPrompts.dataSource
            .getRepository(OB1AgentPromptCategory)
            .findOne({
                where: {
                    promptCategoryId: this.promptCategory.promptCategoryId,
                },
            });

        if (!category) {
            throw new Error('Invalid prompt category');
        }

        // Calculate the prompt version by checking the latest version
        const latestPrompt = await OB1AgentPrompts.dataSource
            .getRepository(OB1AgentPrompts)
            .createQueryBuilder('prompt')
            .where(
                'prompt.promptName = :name AND prompt.promptCategoryId = :categoryId AND prompt.promptCreatedByConsultantOrgShortName = :org',
                {
                    name: this.promptName,
                    categoryId: this.promptCategory.promptCategoryId,
                    org: this.promptCreatedByConsultantOrgShortName,
                }
            )
            .orderBy('prompt.promptVersion', 'DESC')
            .getOne();

        this.promptVersion = (latestPrompt?.promptVersion || 0) + 1;
        //${this.promptCreatedByConsultantOrgShortName}_
        // Generate promptExternalName
        this.promptExternalName = `${category.promptCategoryName}_${this.promptName}_v${this.promptVersion}`
            .toLowerCase() // Ensure all lowercase
            .replace(/[^a-z0-9_]/g, '_'); // Replace invalid characters with underscores

        // Validate the final promptExternalName
        if (!/^[a-z][a-z0-9_]*$/.test(this.promptExternalName)) {
            throw new Error(
                `Generated promptExternalName "${this.promptExternalName}" does not conform to the required format`
            );
        }


        // Use the calculated version to generate the promptExternalName
        //this.promptExternalName = `${this.promptCreatedByConsultantOrgShortName}_${category.promptCategoryName}_${this.promptName}_${this.promptVersion}`;
        this.logger.debug(`Generated New promptExternalName: ${this.promptExternalName}`);

    }


    static setDataSource(dataSource: DataSource) {
        OB1AgentPrompts.dataSource = dataSource;
    }

    @PrimaryGeneratedColumn("uuid", {
        comment: 'Auto-generated unique universal Id for the prompt'
    })
    promptId: string;

    @Column({
        type: 'varchar',
        length: 32,
        comment: 'Human-readable name of the prompt in camelcase'
    })
    @Check(`"promptName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    promptName: string;

    @Column({
        type: 'varchar',
        comment: 'System-generated external name for the prompt'
    })
    promptExternalName: string;

    @Column({
        type: 'text',
        comment: 'Description of what the prompt does'
    })
    promptDescription: string;

    @ManyToOne(() => OB1AgentPromptCategory, category => category.prompts, {
        onDelete: 'RESTRICT', // Prevent deletion of a category if it is referenced
        onUpdate: 'CASCADE',
    })
    @JoinColumn({ name: 'promptCategoryId' }) // Explicitly set the foreign key column name
    promptCategory: OB1AgentPromptCategory;

    @Column({
        type: 'enum',
        enum: OB1Prompt.PromptStatus,
        default: OB1Prompt.PromptStatus.DRAFT,
        comment: 'Current status of the prompt'
    })
    promptStatus: OB1Prompt.PromptStatus;

    @Column({
        type: 'integer',
        default: 1,
        comment: 'Version of the prompt'
    })
    promptVersion: number;


    @Column({
        type: 'varchar',
        comment: 'Short name of the consultant organization that created the prompt in camelCase only'
    })
    @Check(`"promptCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
    promptCreatedByConsultantOrgShortName: string;

    @Column({
        type: 'uuid',
        comment: 'External person ID who created this prompt',
    })
    promptCreatedByPersonId: string;

    @Column({
        type: 'text',
        comment: 'The system prompt template'
    })
    systemPrompt: string;

    //optional user prompt
    @Column({
        type: 'text',
        nullable: true,
        comment: 'The user prompt template'
    })
    userPrompt: string;

    @Column({
        type: 'jsonb',
        comment: 'Variables required for the prompt template',
        default: {}
    })
    systemPromptVariables: Record<string, {
        type: string;
        description: string;
        required: boolean;
        defaultValue?: any;
    }>;

    @Column({
        type: 'jsonb',
        comment: 'Variables required for the prompt template',
        default: {}
    })
    userPromptVariables: Record<string, {
        type: string;
        description: string;
        required: boolean;
        defaultValue?: any;
    }>;

    @Column({
        type: 'jsonb',
        comment: 'Default configuration for LLM',
        default: {}
    })
    promptDefaultConfig: {
        provider: OB1LLM.LLMProvider;
        model: OB1LLM.AnthropicModels | OB1LLM.OpenAIModels;
        temperature?: number;
        maxTokens?: number;
        maxLLMCalls: number;
        maxToolCalls: number;
        maxTotalExecutionTime: number;
        timeout: {
            llmCall: number;
            promptCall: number;
        };
        maxToolCallsPerType: Record<string, number>; //future use
    };

    @Column({
        type: 'text',
        array: true,
        default: '{}',
        comment: 'IDs of prompts that should be available with this prompt'
    })
    promptAvailableTools: string[];

    @Column({
        type: 'text',
        nullable: true,
        default: 'auto',
        comment: 'none or auto or required or the actual prompt as per defination'
    })
    promptToolChoice: OB1LLM.ChatCompletionToolChoiceOption;

    @CreateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'Timestamp when the prompt was created'
    })
    promptCreatedAt: Date;

    @UpdateDateColumn({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
        comment: 'Timestamp when the prompt was last updated'
    })
    promptUpdatedAt: Date;

    @Column({
        type: 'integer',
        default: 0,
        comment: 'Number of times this prompt has been executed'
    })
    promptExecutionCount: number;

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: 'Schema definition for the expected output format, this will be enforced if specified',
    })
    promptResponseFormat: OB1LLM.ResponseFormatJSONSchema;

    @Column({
        type: 'float',
        default: 0,
        comment: 'Average response time in milliseconds'
    })
    promptAvgResponseTime: number;
}
