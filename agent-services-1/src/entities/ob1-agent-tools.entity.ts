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

export enum ToolType {
  PYTHON_SCRIPT = 'python_script',
  API_ENDPOINT = 'api_endpoint',
  SYSTEM_COMMAND = 'system_command',
  DATABASE_QUERY = 'database_query',
  CUSTOM_FUNCTION = 'custom_function'
}

export enum ToolStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  TESTING = 'testing',
  DISABLED = 'disabled'
}

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
  inputSchema: Record<string, any>;

  @Column({
    type: 'jsonb',
    comment: 'Schema definition for the expected output format',
    default: {}
  })
  outputSchema: Record<string, any>;

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
  code?: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'For Python scripts: requirements.txt content'
  })
  requirements?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'For Lambda functions: the function name or ARN'
  })
  functionIdentifier?: string;

  @Column({
    type: 'integer',
    default: 0,
    comment: 'Number of times this tool has been used'
  })
  useCount: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Average execution time in milliseconds'
  })
  avgExecutionTime: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Success rate (0-1) of tool executions'
  })
  @Check(`"successRate" >= 0 AND "successRate" <= 1`)
  successRate: number;

  @Column({
    type: 'jsonb',
    comment: 'Tags for categorizing and searching tools',
    default: []
  })
  tags: string[];

  @Column({
    type: 'integer',
    default: 1,
    comment: 'Tool version number'
  })
  version: number;

  @ManyToOne(() => OB1ToolCategory, category => category.tools)
  category: OB1ToolCategory;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the tool was created'
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the tool was last updated'
  })
  updatedAt: Date;

  @VersionColumn({
    type: 'integer',
    default: 1,
    comment: 'Record version for optimistic locking'
  })
  recordVersion: number;

  @Column({
    type: 'text',
    array: true,
    default: '{}',
    comment: 'List of agent IDs that are allowed to use this tool'
  })
  allowedAgents: string[];

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Rate limiting and usage quota configuration'
  })
  usageQuota: {
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
  examples?: string;

  @Column({
    type: 'jsonb',
    default: {},
    comment: 'Additional metadata specific to the tool'
  })
  metadata: Record<string, any>;
}