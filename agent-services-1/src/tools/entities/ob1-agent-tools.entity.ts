//src/entities/ob1-agent-tools.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Unique, BeforeInsert, BeforeUpdate, DataSource,
  UpdateDateColumn, VersionColumn, ManyToOne, Check,
  JoinColumn
} from 'typeorm';
import { Logger } from '@nestjs/common';
import { OB1AgentToolCategory } from './ob1-agent-toolCategory.entity';
import { OB1Tool } from 'src/tools/interfaces/tools.interface';




@Entity('ob1-agent-tools')
@Unique(['toolCreatedByConsultantOrgShortName', 'toolCategory', 'toolName', 'toolVersion'])
export class OB1AgentTools {
  private readonly logger = new Logger(OB1AgentTools.name);

  private static dataSource: DataSource;

  @BeforeInsert()
  async validateCategoryConsistency() {
    const category = await OB1AgentTools.dataSource
      .getRepository(OB1AgentToolCategory)
      .findOne({
        where: {
          toolCategoryId: this.toolCategory.toolCategoryId,
        },
      });

    if (!category) {
      throw new Error('Invalid tool category');
    }

    if (category.toolCategoryCreatedByConsultantOrgShortName !== this.toolCreatedByConsultantOrgShortName) {
      throw new Error(
        'The tool category does not belong to the same consultant organization as the tool.'
      );
    }
  }

  @BeforeInsert()
  async prepareForInsert() {
    const category = await OB1AgentTools.dataSource
      .getRepository(OB1AgentToolCategory)
      .findOne({
        where: {
          toolCategoryId: this.toolCategory.toolCategoryId,
        },
      });

    if (!category) {
      throw new Error('Invalid tool category');
    }

    // Calculate the tool version by checking the latest version
    const latestTool = await OB1AgentTools.dataSource
      .getRepository(OB1AgentTools)
      .createQueryBuilder('tool')
      .where(
        'tool.toolName = :name AND tool.toolCategoryId = :categoryId AND tool.toolCreatedByConsultantOrgShortName = :org',
        {
          name: this.toolName,
          categoryId: this.toolCategory.toolCategoryId,
          org: this.toolCreatedByConsultantOrgShortName,
        }
      )
      .orderBy('tool.toolVersion', 'DESC')
      .getOne();

    this.toolVersion = (latestTool?.toolVersion || 0) + 1;
    //${this.toolCreatedByConsultantOrgShortName}_
    // Generate toolExternalName
    this.toolExternalName = `${category.toolCategoryName}_${this.toolName}_v${this.toolVersion}`
      .toLowerCase() // Ensure all lowercase
      .replace(/[^a-z0-9_]/g, '_'); // Replace invalid characters with underscores

    // Validate the final toolExternalName
    if (!/^[a-z][a-z0-9_]*$/.test(this.toolExternalName)) {
      throw new Error(
        `Generated toolExternalName "${this.toolExternalName}" does not conform to the required format`
      );
    }


    // Use the calculated version to generate the toolExternalName
    //this.toolExternalName = `${this.toolCreatedByConsultantOrgShortName}_${category.toolCategoryName}_${this.toolName}_${this.toolVersion}`;
    this.logger.debug(`Generated New toolExternalName: ${this.toolExternalName}`);

  }


  static setDataSource(dataSource: DataSource) {
    OB1AgentTools.dataSource = dataSource;
  }

  @PrimaryGeneratedColumn("uuid", {
    comment: 'Auto-generated unique universal Id for the tool'
  })
  toolId: string;

  @Column({
    type: 'varchar',
    length: 32,
    comment: 'Human-readable name of the tool in camelCase only'
  })
  @Check(`"toolName" ~ '^[a-z][a-zA-Z0-9]*$'`)
  toolName: string;

  @Column({
    type: 'varchar',
    comment: 'System-generated external name for the tool'
  })
  toolExternalName: string;

  @Column({
    type: 'text',
    comment: 'Description of what the tool does and how to use it'
  })
  toolDescription: string;

  @Column({
    type: 'enum',
    enum: OB1Tool.ToolType,
    comment: 'Type of tool (Python script, API endpoint, etc.)'
  })
  toolType: OB1Tool.ToolType;

  @Column({
    type: 'enum',
    enum: OB1Tool.ToolStatus,
    default: OB1Tool.ToolStatus.TESTING,
    comment: 'Current status of the tool'
  })
  toolStatus: OB1Tool.ToolStatus;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the required input parameters',
    default: {}
  })
  toolInputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the expected input parameters from environment variables or system',
    default: () => "'{}'"
  })
  toolENVInputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the expected output format',
    default: () => "'{}'"
  })
  toolOutputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Configuration specific to the tool type',
    default: () => "'{}'"
  })
  toolConfig: Record<string, any>;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'For Python scripts: the actual code'
  })
  toolCode?: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'For Python scripts: requirements.txt content'
  })
  toolPythonRequirements?: string;


  @Column({
    type: 'varchar',
    comment: 'Short name of the consultant organization that created the tool'
  })
  @Check(`"toolCreatedByConsultantOrgShortName" ~ '^[a-z][a-zA-Z0-9]*$'`)
  toolCreatedByConsultantOrgShortName: string;

  @Column({
    type: 'uuid',
    comment: 'External person ID who created this tool',
  })
  toolCreatedByPersonId: string;

  @Column({
    type: 'integer',
    default: 0,
    comment: 'Number of times this tool has been used'
  })
  toolUseCount: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Average execution time in milliseconds'
  })
  toolAvgExecutionTime: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Success rate (0-1) of tool executions'
  })
  toolSuccessRate: number;

  // @Check(`"toolsuccessRate" >= 0 AND "toolsuccessRate" <= 1`)


  @Column({
    type: 'jsonb',
    comment: 'Tags for categorizing and searching tools',
    default: []
  })
  toolTags: string[];

  @Column({
    type: 'integer',
    default: 1,
    comment: 'Tool version number'
  })
  toolVersion: number;

  @ManyToOne(() => OB1AgentToolCategory, category => category.tools, {
    onDelete: 'RESTRICT', // Prevent deletion of a category if it is referenced
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'toolCategoryId' }) // Explicitly set the foreign key column name
  toolCategory: OB1AgentToolCategory;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the tool was created'
  })
  toolCreatedAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the tool was last updated'
  })
  toolUpdatedAt: Date;

  @VersionColumn({
    type: 'integer',
    default: 1,
    comment: 'Record version for optimistic locking'
  })
  toolRecordVersion: number;

  @Column({
    type: 'text',
    array: true,
    default: '{}',
    comment: 'List of agent IDs that are allowed to use this tool'
  })
  toolAllowedAgents: string[];

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Rate limiting and usage quota configuration'
  })
  toolUsageQuota: {
    maxCallsPerMinute?: number;
    maxCallsPerHour?: number;
    maxCallsPerDay?: number;
    cooldownPeriod?: number;
  };

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Example usage and expected results'
  })
  toolExamples?: string;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Additional metadata specific to the tool'
  })
  toolMetadata: Record<string, any>;
}