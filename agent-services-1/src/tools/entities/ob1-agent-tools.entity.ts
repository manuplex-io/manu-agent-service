//src/entities/ob1-agent-tools.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  Check
} from 'typeorm';
import { OB1ToolCategory } from './ob1-agent-toolCategory.entity';
import { ToolType, ToolStatus } from 'src/tools/interfaces/tools.interface';



@Entity('ob1-agent-tools')
export class OB1AgentTools {
  @PrimaryGeneratedColumn("uuid", {
    comment: 'Auto-generated unique universal Id for the tool'
  })
  toolId: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Human-readable name of the tool'
  })
  toolName: string;

  @Column({
    type: 'text',
    comment: 'Description of what the tool does and how to use it'
  })
  toolDescription: string;

  @Column({
    type: 'enum',
    enum: ToolType,
    comment: 'Type of tool (Python script, API endpoint, etc.)'
  })
  toolType: ToolType;

  @Column({
    type: 'enum',
    enum: ToolStatus,
    default: ToolStatus.TESTING,
    comment: 'Current status of the tool'
  })
  toolStatus: ToolStatus;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the required input parameters',
    default: {}
  })
  toolInputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the expected input parameters from environment variables or system',
    default: {}
  })
  toolENVinputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the expected output format',
    default: {}
  })
  toolOutputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Configuration specific to the tool type',
    default: {}
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
    length: 255,
    nullable: true,
    comment: 'For Lambda functions: the function name or ARN'
  })
  toolIdentifier?: string;

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

  @ManyToOne(() => OB1ToolCategory, category => category.tools)
  toolCategory: OB1ToolCategory;

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