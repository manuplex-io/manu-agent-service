// /src/rags/interface/rag.interface.ts
    
export namespace OB1RAG {
    export interface CreateRAGDataset {
        context: string;
        ragDataMetadata: Record<string, any>;
        ragExecutionConfig: Record<string, any>;
        consultantOrgShortName: string;
        personId: string;
    }

    export interface CreateChunkRAGDataset extends CreateRAGDataset {
        chunkId: number;
    }

    export interface RAGChunkResponse {
        chunkId: number;
        content: string;
        embedding?: number[];
        metadata?: Record<string, any>;
    }

    export interface RAGDatasetResponse {
        success: boolean;
        data: RAGChunkResponse[];
    }
}