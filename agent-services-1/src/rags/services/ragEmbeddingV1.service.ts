import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai';
import { OB1RAG } from '../interface/rag.interface';

@Injectable()
export class RAGEmbeddingV1Service {
    private readonly logger = new Logger(RAGEmbeddingV1Service.name);
    private readonly openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: PORTKEY_GATEWAY_URL,
            defaultHeaders: createHeaders({
                provider: "openai",
                apiKey: process.env.PORTKEY_API_KEY
            })
        });
    }
    public async createOPENAIEmbedding(chunks: OB1RAG.CreateChunkRAGDataset[]): Promise<OB1RAG.RAGChunkResponse[]> {
        const responses: OB1RAG.RAGChunkResponse[] = [];

        for (const chunk of chunks) {
            try {
                const embedding = await this.openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunk.context,
                });

                responses.push({
                    chunkId: chunk.chunkId,
                    content: chunk.context,
                    embedding: embedding.data[0].embedding,
                    metadata: {
                        ...chunk.ragDataMetadata,
                        consultantOrgShortName: chunk.consultantOrgShortName,
                        personId: chunk.personId
                    }
                });
            } catch (error) {
                this.logger.error(`Error creating embedding for chunk ${chunk.chunkId}:`, error);
                throw error;
            }
        }

        return responses;
    }

    public async createOPENAIEmbeddingWithoutChunk(input: string): Promise<OB1RAG.RAGChunkResponse> {
        try {
            const embedding = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: input,
            });

            return {
                chunkId: 0,
                content: input,
                embedding: embedding.data[0].embedding
            };
        } catch (error) {
            this.logger.error(`Error creating embedding for input:`, error);
            throw error;
        }
    }
}
