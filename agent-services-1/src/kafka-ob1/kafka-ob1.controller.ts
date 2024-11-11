// src/kafka-ob1/kafka-ob1.controller.ts
import { Controller, OnModuleInit, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { OB1MessageValue, OB1MessageHeader, validateMessageFields, CURRENT_SCHEMA_VERSION } from 'src/kafka-ob1/interfaces/ob1-message.interfaces';
import { KafkaOb1ProcessingService } from './services/kafka-ob1-processing/kafka-ob1-processing.service';

@Controller('kafka-ob1')
export class KafkaOb1Controller implements OnModuleInit {
  private readonly logger = new Logger(KafkaOb1Controller.name);

  constructor(
    private kafkaOb1ProcessingService: KafkaOb1ProcessingService,

  ) { }

  onModuleInit() {
    this.logger.log('Kafka consumer initialized and started');
    // Add any initialization logic if necessary
  }

  @MessagePattern('manuos-ob1-testService')
  async handleSystemMessages(@Payload() message: OB1MessageValue, @Ctx() context: KafkaContext) {
    const messageKey = context.getMessage().key?.toString();
    // Cast headers from IHeaders to OB1MessageHeader by using 'unknown' first
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
    const userEmail = messageHeaders.userEmail;
    const SERVICE_NAME = process.env.SERVICE_NAME;

    this.logger.debug(`Received message with key: ${messageKey} for user ${userEmail}`);
    this.logger.debug(`Headers: ${JSON.stringify(messageHeaders)}`);
    this.logger.debug(`Payload: ${JSON.stringify(message)}`);

    // Validate message schema; logs errors if necessary
    try {
      validateMessageFields(context);
    } catch (error) {
      // Format error response
      const errorHeaders: OB1MessageHeader = {
        instanceName: messageHeaders.instanceName,
        userEmail,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceService: SERVICE_NAME,
        destinationService: messageHeaders.sourceService,
        sourceType: 'system',
        requestId: messageHeaders.requestId || `Not-Sent-${Date.now()}`,
        responseId: `ERR-${SERVICE_NAME}-${Date.now()}`, // Unique error response Id
      };

      const errorResponseValue: OB1MessageValue = {
        messageType: 'ERROR_RESPONSE',
        error: true,
        messageContent: {
          errorMessage: error.message || 'An unknown error occurred',
          errorStack: error.stack || null, // Optional: include stack trace
        },
        conversationId: message.conversationId || null,
        projectId: message.projectId || null,
        assetId: message.assetId || null,
      };
      this.logger.debug(`Returning error response with error headers: ${JSON.stringify(errorHeaders)}`);
      return {
        key: '',
        value: errorResponseValue,
        headers: errorHeaders,
      };


    }



    // Check if the message is intended for this service
    if (messageHeaders.destinationService !== SERVICE_NAME) {
      this.logger.log(`Message not intended for this service (${SERVICE_NAME}) but instead for ${messageHeaders.destinationService}. Ignoring.`);
      return { messageStatus: 'error', errorMessage: `Message not intended for this service (${SERVICE_NAME}) but instead for ${messageHeaders.destinationService}` };
    }

    // Process message if intended for this service
    this.logger.log(`Processing message intended for ${SERVICE_NAME}`);

    try {
      const result = await this.kafkaOb1ProcessingService.processRequest(message, context);
      //create a dummy result with the messageContent with dummy response i.e key value pair
      // const result = {
      //   messageContent: {
      //     content: 'dummy response back',
      //   },
      // };

      const responseHeaders: OB1MessageHeader = {
        instanceName: messageHeaders.instanceName,
        userEmail,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceService: SERVICE_NAME,
        destinationService: messageHeaders.sourceService,
        sourceType: 'system',
        requestId: messageHeaders.requestId || `Not-Sent-${Date.now()}`,
        responseId: `RE-${SERVICE_NAME}-${Date.now()}`, // Unique response Id
      };

      const messageContent = { ...result };

      const responseValue: OB1MessageValue = {
        messageContent,
        messageType: 'RESPONSE',
        conversationId: message.conversationId || null,
        projectId: message.projectId || null,
        assetId: message.assetId || null,
      };

      this.logger.debug(`Returning response with headers: ${JSON.stringify(responseHeaders)}`);
      return {
        key: '',
        value: responseValue,
        headers: responseHeaders,
      };
    } catch (error) {
      // Format error response
      const errorHeaders: OB1MessageHeader = {
        instanceName: messageHeaders.instanceName,
        userEmail,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceService: SERVICE_NAME,
        destinationService: messageHeaders.sourceService,
        sourceType: 'system',
        requestId: messageHeaders.requestId || `Not-Sent-${Date.now()}`,
        responseId: `ERR-${SERVICE_NAME}-${Date.now()}`, // Unique error response Id
      };

      const errorResponseValue: OB1MessageValue = {
        messageType: 'ERROR_RESPONSE',
        error: true,
        messageContent: {
          errorMessage: error.message || 'An unknown error occurred',
          errorStack: error.stack || null, // Optional: include stack trace
        },
        conversationId: message.conversationId || null,
        projectId: message.projectId || null,
        assetId: message.assetId || null,
      };
      this.logger.debug(`Returning error response with error headers: ${JSON.stringify(errorHeaders)}`);
      return {
        key: '',
        value: errorResponseValue,
        headers: errorHeaders,
      };
    }
  }
}


