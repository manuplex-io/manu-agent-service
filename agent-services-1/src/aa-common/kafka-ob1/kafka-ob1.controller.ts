// /src/kafka-ob1/kafka-ob1.controller.ts
import { Controller, OnModuleInit, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import {
  OB1Global,
  OB1AgentService,
  validateIncomingKafkaMessageFields,
  validateOutgoingMessageHeader,
  CURRENT_SCHEMA_VERSION,
} from 'src/aa-common/kafka-ob1/interfaces/ob1-message.interfaces';
import { KafkaOb1ProcessingService } from './services/kafka-ob1-processing/kafka-ob1-processing.service';

const DEFAULT_AS_REQUEST_TIMEOUT_MS = parseInt(process.env.DEFAULT_AS_REQUEST_TIMEOUT_MS || '60000', 10);

@Controller('kafka-ob1')
export class KafkaOb1Controller implements OnModuleInit {
  private readonly logger = new Logger(KafkaOb1Controller.name);

  constructor(private kafkaOb1ProcessingService: KafkaOb1ProcessingService) { }

  onModuleInit() {
    this.logger.log('Kafka consumer initialized and started');
  }

  @MessagePattern('manuos-ob1-agentService')
  async handleSystemMessages(
    @Payload() message: OB1AgentService.MessageIncomingValueV2,
    @Ctx() context: KafkaContext,
  ) {
    const SERVICE_NAME = process.env.SERVICE_NAME;
    const messageHeaders = context.getMessage().headers as unknown as OB1Global.MessageHeaderV2;

    try {
      // Validate incoming message
      validateIncomingKafkaMessageFields(context);

      // Process the message with timeout
      const result = await this.requestWithTimeout(
        () => this.kafkaOb1ProcessingService.processRequest(message, context),
        DEFAULT_AS_REQUEST_TIMEOUT_MS
      );

      // Build response
      return this.buildResponse(
        'RESPONSE',
        SERVICE_NAME,
        messageHeaders,
        { ...result },
        message,
      );
    } catch (error) {
      this.logger.error(`Error while processing message, Error caught from downstream system: ${error.message}`, error.stack);
      this.logger.log(`errorDetails:\n${JSON.stringify(error, null, 2)}`);
      // Build error response
      return this.buildResponse(
        'ERROR_RESPONSE',
        SERVICE_NAME,
        messageHeaders,
        {
          errorMessage: error.message || 'An unknown error occurred',
          errorDetails: { ...error },
          errorStack: error.stack || 'error stack not available',
          // errorMessage: error.message || 'An unknown error occurred',
          // errorDetails: error.details || 'details not provided',
          // errorStack: error.stack || null,
        },
        message,
        error.status
      );
    }
  }

  private async requestWithTimeout<T>(task: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, timeout);

      task()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Builds a response message with appropriate headers and value.
   */
  private async buildResponse(
    messageType: 'RESPONSE' | 'ERROR_RESPONSE',
    serviceName: string,
    incomingHeaders: OB1Global.MessageHeaderV2,
    messageContent: { [key: string]: any },
    originalMessage: OB1AgentService.MessageIncomingValueV2,
    downstreamCode?: number, // Optional errorCode or responseCode passed from downstream system
  ) {
    const isError = messageType === 'ERROR_RESPONSE';
    const code = downstreamCode || (isError ? 500 : 200); // Default error or success code

    const responseHeaders: OB1Global.MessageHeaderV2 = {
      userOrgId: incomingHeaders.userOrgId || 'Unknown userOrgId',
      personId: incomingHeaders.personId || 'Unknown personId',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sourceService: serviceName,
      destinationService: incomingHeaders.sourceService,
      sourceType: 'system',
      requestId: incomingHeaders.requestId || `Not-Sent-${Date.now()}`,
      responseId: `${isError ? 'ERR' : 'RE'}-${serviceName}-${Date.now()}`,
    };

    const responseValue: OB1Global.MessageResponseValueV2 = {
      messageType,
      messageContent: {
        ...messageContent,
        errorCode: isError ? code : undefined, // Include errorCode for errors
        responseCode: isError ? undefined : code, // Include responseCode for success
      },
      error: isError, // Compulsory error field
      conversationId: originalMessage.conversationId || null,
      projectId: originalMessage.projectId || null,
      assetId: originalMessage.assetId || null,
    };

    // Validate outgoing headers
    await validateOutgoingMessageHeader(responseHeaders);

    this.logger.debug(
      `${isError ? 'Returning error response' : 'Returning response'} with headers: ${JSON.stringify(
        responseHeaders,
      )}, and value: ${JSON.stringify(responseValue)}`,
    );

    return {
      key: '',
      value: responseValue,
      headers: responseHeaders,
    };
  }
}
