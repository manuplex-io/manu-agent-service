// src/kafka-ob1/services/kafka-ob1-processing/kafka-ob1-processing.service.ts
import { Injectable, Logger, ValidationPipe, BadRequestException } from '@nestjs/common';
import { OB1MessageValue, OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaContext } from '@nestjs/microservices';
import { LLMRequest, LLMResponse } from 'src/llm/interfaces/llm.interfaces';
import { LLMService } from 'src/llm/services/llm.service';


@Injectable()
export class KafkaOb1ProcessingService {
    private readonly logger = new Logger(KafkaOb1ProcessingService.name);
    private validationPipe = new ValidationPipe({ transform: true, whitelist: true }); // Instantiates ValidationPipe
    constructor(
        private llmService: LLMService,


    ) { }

    async processRequest(message: OB1MessageValue, context: KafkaContext) {
        const messageHeaders = context.getMessage().headers;
        const userEmail = messageHeaders['userEmail'] as string;

        try {
            const functionName = message.messageContent.functionName;
            let functionInput = message.messageContent.functionInput;

            // Validate functionInput as LLMRequest
            try {
                functionInput = await this.validationPipe.transform(functionInput, { metatype: LLMRequest, type: 'body' });
            } catch (validationError) {
                this.logger.error(`Validation failed for functionInput: ${validationError.message}`, validationError.stack);
                throw new BadRequestException('Invalid functionInput format');
            }

            // Check if the function exists and call it
            // Check if the function is CRUDUserfunction and handle accordingly
            if (functionName === 'LLMgenerateResponse') {
                return await this.llmService.generateResponse(functionInput);
            }
            else if (functionName === 'CRUDInstancesfunction') {
                return { errorMessage: 'CRUDInstancesfunction not implemented' };
            } else {
                this.logger.error(`Function ${functionName} not found`);
                return { errorMessage: `Function ${functionName} not found` };
            }
        } catch (error) {
            this.logger.error(`Error processing message for user with email ${userEmail}: ${error.message}`, error.stack);
            throw new Error('Failed to process request');
        }
    }

}
