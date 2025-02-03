import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { RAGDatasetManagementV1Service } from 'src/rags/services/ragDatasetManagementV1.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDRAGRoute,
} from '../../../interfaces/CRUD.interfaces';
import { OB1RAGDto as RAGDto } from 'src/rags/Dto/rags.Dto';
import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class RAGCRUDV1 {
    private readonly logger = new Logger(RAGCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly ragDatasetManagementV1Service: RAGDatasetManagementV1Service,

    ) {
        this.validationPipe = new ValidationPipe({
            transform: true,
            whitelist: true,
            validationError: {
                target: false,
                value: true,
            },
            exceptionFactory: (errors) => {
                const validationErrorMessages = errors.map((error) => ({
                    errorProperty: error.property,
                    constraints: error.constraints,
                    value: error.value,
                }));
                this.logger.error(`Validation Pipe OUTPUT: ${JSON.stringify(validationErrorMessages, null, 2)}`);
                return new BadRequestException({
                    message: 'Validation failed',
                    details: validationErrorMessages,
                });
            },
        });
    }

    async CRUDRAGRoutes(functionInput: CRUDFunctionInputExtended) {
        try {
            const {
                CRUDOperationName: operation,
                CRUDRoute: route,
                CRUDBody,
                routeParams,
                queryParams,
                requestMetadata,
            } = functionInput;

            // Retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // Add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
                ragExecutionConfig: { requestMetadata },
            };

            this.logger.debug(`CRUDRAGRoutes: functionInput:\n${JSON.stringify(functionInput, null, 2)}`);
            this.logger.debug(`CRUDRAGRoutes: CRUDBodyWithConsultantPayload:\n${JSON.stringify(CRUDBodyWithConsultantPayload, null, 2)}`);

            switch (`${operation}-${route}`) {
                // RAG Routes
                case `${CRUDOperationName.POST}-${CRUDRAGRoute.CREATE_DATASET}`: {
                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: RAGDto.CreateRAGDto, type: 'body' },
                    );
                    return await this.ragDatasetManagementV1Service.createRAGDataset(validatedBody);
                }
                default:
                    throw new BadRequestException({
                        message: `Invalid RAG operation: ${operation} - ${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {
            this.logger.error(`Error processing rag CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
