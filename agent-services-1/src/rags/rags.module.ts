import { Global, Module } from '@nestjs/common';
import { RAGDataProcessingV1Service } from './services/ragDataProcessingV1.service';
import { RAGEmbeddingV1Service } from './services/ragEmbeddingV1.service';
import { RAGDatasetManagementV1Service } from './services/ragDatasetManagementV1.service';
@Global() // Makes this module globally accessible
@Module({
    imports: [

    ],
    providers: [
        RAGDataProcessingV1Service,
        RAGEmbeddingV1Service,
        RAGDatasetManagementV1Service,
    ],
    exports: [
        RAGDataProcessingV1Service,
        RAGEmbeddingV1Service,
        RAGDatasetManagementV1Service,
    ],
})
export class RagModule { }
