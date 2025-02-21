import { Module, Logger } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaOb1Controller } from './kafka-ob1.controller';
import { LLMModule } from 'src/llms/llms.module';
import { KafkaOb1ProcessingService } from './services/kafka-ob1-processing/kafka-ob1-processing.service';
import { PromptCRUDV1 } from './services/kafka-ob1-processing/functions/promptCRUDV1.service';
import { ToolCRUDV1 } from './services/kafka-ob1-processing/functions/toolCRUDV1.service';
import { ActivityCRUDV1 } from './services/kafka-ob1-processing/functions/activityCRUDV1.service';
import { WorkflowCRUDV1 } from './services/kafka-ob1-processing/functions/workflowCRUDV1.service';
import { LLMCRUDV1 } from './services/kafka-ob1-processing/functions/llmCRUDV1.service';
// import { RAGCRUDV1 } from './services/kafka-ob1-processing/functions/ragCRUDV1.service';

@Module({
  imports: [
    ConfigModule,
    LLMModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_OB1_CLIENT',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${configService.get<string>('SERVICE_ID')}-client`,
              brokers: ['kafka-server-1.manuplex-uswest-2.local:9092'],
            },
            consumer: {
              groupId: `${configService.get<string>('SERVICE_NAME')}-group`,
              allowAutoTopicCreation: false,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [
    KafkaOb1ProcessingService,
    PromptCRUDV1,
    ToolCRUDV1,
    ActivityCRUDV1,
    WorkflowCRUDV1,
    LLMCRUDV1,
    // RAGCRUDV1,
  ],
  controllers: [KafkaOb1Controller],
})
export class KafkaOb1Module { }
