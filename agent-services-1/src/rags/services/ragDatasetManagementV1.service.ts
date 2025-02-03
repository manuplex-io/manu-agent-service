// /src/workflows/services/workflowManagementV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { OB1AgentRags } from '../entities/ob1-agent-rags.entity';
import { OB1RAG } from '../interface/rag.interface';
import { RAGDataProcessingV1Service } from './ragDataProcessingV1.service';
import { RAGEmbeddingV1Service } from './ragEmbeddingV1.service';

@Injectable()
export class RAGDatasetManagementV1Service {
    private readonly logger = new Logger(RAGDatasetManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentRags, 'vectorDb') private readonly ragDatasetRepository: Repository<OB1AgentRags>,
        private readonly ragProcessingService: RAGDataProcessingV1Service,
        private readonly ragEmbeddingService: RAGEmbeddingV1Service
    ) { }

    // Create RAG Dataset
    async createRAGDataset(
        ragCreateDataset: OB1RAG.CreateRAGDataset,
    ): Promise<OB1RAG.RAGDatasetResponse> {
        try {
            // Build chunks
            const chunks = await this.ragProcessingService.createChunkRAGDataset(ragCreateDataset);
            // Run embedding
            const embeddedChunks = await this.ragEmbeddingService.createOPENAIEmbedding(chunks);
            // Save to database
            const savedEntities = await Promise.all(
                embeddedChunks.map(chunk => {
                    const ragEntity = this.ragDatasetRepository.create({
                        chunkId: chunk.chunkId,
                        content: chunk.content,
                        embedding: chunk.embedding,
                        ragDataMetadata: chunk.metadata,
                        dataCreatedByPersonId: ragCreateDataset.personId,
                        dataTags: chunk.metadata.tags || []
                    });
                    return this.ragDatasetRepository.save(ragEntity);
                })
            );

            return {
                success: true,
                data: embeddedChunks.map(this.convertToRAGChunkResponse)
            };
        } catch (error) {
            this.logger.error(`Failed to create RAG dataset:`, error);
            throw new BadRequestException({
                message: 'Failed to create RAG dataset',
                errorSuperDetails: { ...error },
            });
        }
    }

    private convertToRAGChunkResponse(chunk: OB1RAG.RAGChunkResponse): OB1RAG.RAGChunkResponse {
        return {
            chunkId: chunk.chunkId,
            content: chunk.content,
            metadata: chunk.metadata
        };
    }

}