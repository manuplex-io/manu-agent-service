import { Injectable, Logger, ValidationPipe, } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { OB1Global, OB1AgentService, generateDefaultErrorMessageResponseValue } from 'src/aa-common/kafka-ob1/interfaces/ob1-message.interfaces';
import { LLMRequestV1 } from 'src/llms/interfaces/llmV1.interfaces';
import { OB1LLM } from 'src/llms/interfaces/llmV2.interfaces';
import { OB1LLMDto } from 'src/llms/Dto/llmV2.Dto';
import { CRUDFunctionInput, CRUDFunctionInputExtended } from 'src/aa-common/kafka-ob1/interfaces/CRUD.interfaces';
import { LLMServiceV1 } from 'src/llms/services/llmV1.service';
import { LLMV2Service } from 'src/llms/services/llmV2.service';
import { PromptCRUDV1 } from 'src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/promptCRUDV1.service';
import { ToolCRUDV1 } from 'src/aa-common/kafka-ob1/services/kafka-ob1-processing/functions/toolCRUDV1.service';
import { ActivityCRUDV1 } from './functions/activityCRUDV1.service';
import { WorkflowCRUDV1 } from './functions/workflowCRUDV1.service';


@Injectable()
export class KafkaOb1ProcessingService {
    private readonly logger = new Logger(KafkaOb1ProcessingService.name);
    private readonly validationPipe = new ValidationPipe({ transform: true, whitelist: true });

    constructor(
        private llmServiceV1: LLMServiceV1,
        private llmV2Service: LLMV2Service,
        private promptCRUDV1: PromptCRUDV1,
        private toolCRUDV1: ToolCRUDV1,
        private activityCRUDV1: ActivityCRUDV1,
        private workflowCRUDV1: WorkflowCRUDV1,

    ) { }

    async processRequest(message: OB1AgentService.MessageIncomingValueV2, context: KafkaContext) {
        const OB1Headers = context.getMessage().headers as unknown as OB1Global.MessageHeaderV2;

        const functionName = message.messageContent.functionName;
        let functionInput = message.messageContent.functionInput;

        switch (functionName) {
            case 'LLMgenerateResponse-V1': {
                const validatedInput = await this.validateInput(functionInput, LLMRequestV1, functionName) as LLMRequestV1;
                return this.llmServiceV1.generateResponseV1(validatedInput);
            }

            case 'LLMgenerateResponse-V2': {
                const validatedInput = await this.validateInput(functionInput, OB1LLMDto.LLMRequest, functionName) as OB1LLMDto.LLMRequest;
                const inputWithTracing = this.addTracingMetadata(validatedInput, OB1Headers) as OB1LLM.LLMRequest;
                return this.llmV2Service.generateResponseWithStructuredOutputNoTools(inputWithTracing);
            }

            case 'promptCRUD-V1': {
                const validatedInput = await this.validateInput(functionInput, CRUDFunctionInput, functionName) as CRUDFunctionInput;
                const inputWithTracing = this.addTracingMetadata(validatedInput, OB1Headers) as CRUDFunctionInputExtended;
                this.logger.log(`promptCRUD-V1: inputWithTracing:\n${JSON.stringify(inputWithTracing, null, 2)}`);
                return this.promptCRUDV1.CRUDPromptRoutes(inputWithTracing);
            }

            case 'toolCRUD-V1': {
                const validatedInput = await this.validateInput(functionInput, CRUDFunctionInput, functionName) as CRUDFunctionInput;
                const inputWithTracing = this.addTracingMetadata(validatedInput, OB1Headers) as CRUDFunctionInputExtended;
                this.logger.log(`toolCRUD-V1: inputWithTracing:\n${JSON.stringify(inputWithTracing, null, 2)}`);
                return this.toolCRUDV1.CRUDToolRoutes(inputWithTracing);
            }
            case 'activityCRUD-V1': {
                const validatedInput = await this.validateInput(functionInput, CRUDFunctionInput, functionName) as CRUDFunctionInput;
                const inputWithTracing = this.addTracingMetadata(validatedInput, OB1Headers) as CRUDFunctionInputExtended;
                this.logger.log(`activityCRUD-V1: inputWithTracing:\n${JSON.stringify(inputWithTracing, null, 2)}`);
                return this.activityCRUDV1.CRUDActivityRoutes(inputWithTracing);
            }
            case 'workflowCRUD-V1': {
                const validatedInput = await this.validateInput(functionInput, CRUDFunctionInput, functionName) as CRUDFunctionInput;
                const inputWithTracing = this.addTracingMetadata(validatedInput, OB1Headers) as CRUDFunctionInputExtended;
                this.logger.log(`workflowCRUD-V1: inputWithTracing:\n${JSON.stringify(inputWithTracing, null, 2)}`);
                return this.workflowCRUDV1.CRUDWorkflowRoutes(inputWithTracing);
            }

            default:
                this.logger.error(`Function ${functionName} not found`);
                return generateDefaultErrorMessageResponseValue(
                    404,
                    `Function ${functionName} not found`,
                    { functionName, headers: OB1Headers },
                );
        }
    }


    /**
     * Validates the function input using the provided metatype.
     */
    private async validateInput(input: any, metatype: any, functionName: string): Promise<any> {
        try {
            return await this.validationPipe.transform(input, { metatype, type: 'body' });
        } catch (validationError) {
            this.logger.error(`Validation failed for ${functionName}`, validationError);
            return generateDefaultErrorMessageResponseValue(
                400,
                `Validation failed for ${functionName}`,
                { details: validationError?.response?.message || 'Unknown validation error' },
            );
        }
    }

    /**
     * Adds tracing and metadata information to the request.
     */
    private addTracingMetadata<T extends { tracing?: any; requestMetadata?: any }>(
        input: T,
        headers: OB1Global.MessageHeaderV2,
    ): T & {
        // tracing: { traceId: string };
        requestId: string;
        requestMetadata: {
            personId: string;
            userOrgId: string;
            sourceService: string
        }
    } {
        return {
            ...input,
            requestId: headers.requestId,
            // tracing: {
            //     traceId: headers.requestId,
            // },
            requestMetadata: {
                ...input.requestMetadata,
                "_user": headers.personId,
                personId: headers.personId,
                userOrgId: headers.userOrgId,
                sourceService: headers.sourceService,
                ENV: process.env.ENV,
            },
        };
    }

}
