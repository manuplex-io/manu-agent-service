// /src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/workflowCRUDV1.service.ts

import { Injectable, ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { LLMV3Service } from 'src/llms/services/llmV3.service';
import {
    CRUDFunctionInputExtended,
    CRUDOperationName,
    CRUDLLMRoute,
} from '../../../interfaces/CRUD.interfaces';

import { OB1LLMV3Dto as LLMV3Dto } from 'src/llms/Dto/llmV3.Dto';
import { OB1WorkflowDto as WorkflowDto } from 'src/workflows/Dto/workflow.Dto';

import { PersonPayload } from 'src/aa-common/kafka-ob1/interfaces/personPayload.interface';

@Injectable()
export class LLMCRUDV1 {
    private readonly logger = new Logger(LLMCRUDV1.name);
    private validationPipe: ValidationPipe;

    constructor(
        private readonly llmV3Service: LLMV3Service,
    ) {
        this.validationPipe = new ValidationPipe({
            transform: true,
            whitelist: true,
            // forbidNonWhitelisted: true, // Uncomment to raise error if extra properties not in the DTO
            validationError: {
                target: false, // Hides the original object in error response
                value: true,   // Shows the value causing the error
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

    async CRUDLLMRoutes(functionInput: CRUDFunctionInputExtended) {
        try {
            const {
                CRUDOperationName: operation,
                CRUDRoute: route,
                CRUDBody,
                routeParams,
                queryParams,
            } = functionInput;

            // Retrieve consultantPayload as PersonPayload from the CRUDBody
            const consultantPayload = CRUDBody?.consultantPayload as PersonPayload;

            // Add the contents of the consultantPayload to the CRUDBody
            const CRUDBodyWithConsultantPayload = {
                ...CRUDBody,
                consultantOrgShortName: consultantPayload?.consultantOrgShortName,
                personId: consultantPayload?.personId,
            };
            switch (`${operation}-${route}`) {
                // Workflow Routes
                case `${CRUDOperationName.POST}-${CRUDLLMRoute.GENERATE_LLM_RESPONSE}`: {

                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: LLMV3Dto.OB1GenericLLMRequestDto, type: 'body' },
                    );
                    return await this.llmV3Service.generateAnyLLMResponse(validatedBody);
                }
                case `${CRUDOperationName.POST}-${CRUDLLMRoute.GENERATE_LLM_RESPONSE_WITH_RAG}`: {

                    const validatedBody = await this.validationPipe.transform(
                        CRUDBodyWithConsultantPayload,
                        { metatype: LLMV3Dto.OB1GenericLLMRequestDto, type: 'body' },
                    );
                    return await this.llmV3Service.generateAnyLLMResponseWithRAG(validatedBody);
                }
                default:
                    throw new BadRequestException({
                        message: `Invalid llm operation: ${operation} - ${route}`,
                        details: { functionInput },
                    });
            }
        } catch (error) {
            this.logger.error(`Error processing workflow CRUD operation:\n${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }
}
