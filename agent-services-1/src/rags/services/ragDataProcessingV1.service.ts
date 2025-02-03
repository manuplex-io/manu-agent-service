// /src/workflows/services/workflowManagementV1.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { decode, encode } from 'gpt-tokenizer';

import { OB1RAG } from '../interface/rag.interface';
// import * as ts from 'typescript';


@Injectable()
export class RAGDataProcessingV1Service {
    private readonly logger = new Logger(RAGDataProcessingV1Service.name);
    //REPLACE WITH ENV VARIABLE
    // private readonly CHUNK_SIZE = 500;
    // private readonly CHUNK_OVERLAP = 100;
    private readonly SENTENCES_PER_CHUNK = 5;
    private readonly SENTENCE_OVERLAP = 2;
    
    constructor(
    ) { }
    //#region workflow loading specific validation
    public async createChunkRAGDataset(request: OB1RAG.CreateRAGDataset): Promise<OB1RAG.CreateChunkRAGDataset[]> {
        try{
        const { context, ragDataMetadata, ragExecutionConfig, consultantOrgShortName, personId } = request;
            
        const sentences = context.match(/[^.!?]+[.!?]+/g) || [];
        const chunks: OB1RAG.CreateChunkRAGDataset[] = [];
        let chunkId = 0;

        for (let i = 0; i < sentences.length; i += (this.SENTENCES_PER_CHUNK - this.SENTENCE_OVERLAP)) {
            const chunkSentences = sentences.slice(i, i + this.SENTENCES_PER_CHUNK);
            
            // Only create chunk if we have sentences
            if (chunkSentences.length > 0) {
                chunks.push({
                    chunkId,
                    context: chunkSentences.join(' ').trim(),
                    ragDataMetadata,
                    ragExecutionConfig,
                    consultantOrgShortName,
                    personId
                });
                chunkId++;
            }
        }

        return chunks;
        
        } catch (error) {
            this.logger.error(`Error creating chunk RAG dataset: ${error}`);
            throw error;
        }
    }
}

    
