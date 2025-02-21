import {
    Entity, 
    Column, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn, 
    VersionColumn, 
    Unique, 
    BeforeInsert, 
    DataSource, 
    ManyToOne, 
    JoinColumn, 
    Check
  } from 'typeorm';
  import { Logger } from '@nestjs/common';
  import { ValueTransformer } from 'typeorm';

  export const vectorTransformer: ValueTransformer = {
    to: (value: number[]): string => {
      if (!value) return null;
      return `[${value.join(',')}]`;
    },
    from: (value: string): number[] => {
      if (!value) return null;
      return value.slice(1, -1).split(',').map(Number);
    }
  };

  @Entity('ob1-agent-rags')
  export class OB1AgentRags {
    private readonly logger = new Logger(OB1AgentRags.name);
  
    private static dataSource: DataSource;
  
    static setDataSource(dataSource: DataSource) {
      OB1AgentRags.dataSource = dataSource;
    }
  
    @PrimaryGeneratedColumn('uuid', {
      comment: 'Auto-generated unique universal Id for the RAG data'
    })
    id: string;
  
    @Column({
      type: 'integer',
      comment: 'Unique ID for each chunk of data'
    })
    chunkId: number;
  
    @Column({
      type: 'text',
      nullable: false,
      comment: 'The chunk content of the RAG data'
    })
    content: string;
  
    @Column({
      type: 'jsonb',
      comment: 'Metadata associated with the chunk (source, tags, etc.)',
      default: {}
    })
    ragDataMetadata: Record<string, any>;
  
    
    @Column({
      // @ts-ignore TypeORM does not support but the database supports
      type: 'vector',
      nullable: true,
      transformer: vectorTransformer
    })
    embedding: number[];
    
    @Column({
      type: 'uuid',
      comment: 'External person ID who created this RAG data'
    })
    dataCreatedByPersonId: string;
  
    @Column({
      type: 'jsonb',
      comment: 'Tags for categorizing and searching RAG data',
      default: []
    })
    dataTags: string[];
  
    @CreateDateColumn({
      type: 'timestamptz',
      default: () => 'CURRENT_TIMESTAMP',
      comment: 'Timestamp when the RAG data was created'
    })
    dataCreatedAt: Date;
  
    @UpdateDateColumn({
      type: 'timestamptz',
      default: () => 'CURRENT_TIMESTAMP',
      comment: 'Timestamp when the RAG data was last updated'
    })
    dataUpdatedAt: Date;
  }
  