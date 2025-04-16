import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  console.log("app started")
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'debug', 'error', 'warn', 'verbose'], // Adjust based on LOG_LEVEL
  });
  const SERVICE_NAME = process.env.SERVICE_NAME;
  const KAFKA_SESSION_TIMEOUT = parseInt(process.env.KAFKA_SESSION_TIMEOUT) || 60000;
  const KAFKA_HEARTBEAT_INTERVAL = parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL) || 20000;

  // Kafka microservice options
  const kafkaMicroserviceOptions: MicroserviceOptions = {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['kafka-server-1.manuplex-uswest-2.local:9092',
                  'kafka-server-2.manuplex-uswest-2.local:9092',
                  'kafka-server-3.manuplex-uswest-2.local:9092',
                ], 
        // Kafka broker address
        // connectionTimeout: 3000,
        // requestTimeout: 60000,
      },
      consumer: {
        groupId: `${SERVICE_NAME}-group`, // Consumer group ID
        sessionTimeout: KAFKA_SESSION_TIMEOUT,
        heartbeatInterval: KAFKA_HEARTBEAT_INTERVAL,
        // maxWaitTimeInMs: 10000,
        // rebalanceTimeout: 90000,
      },
      producer: {
        allowAutoTopicCreation: false, // Optional: Prevents auto-creation of topics if they don't exist
        // transactionTimeout: 120000,
      },
    },
  };

  // Connect Kafka microservice
  app.connectMicroservice(kafkaMicroserviceOptions);

  // Start all microservices (including Kafka)
  await app.startAllMicroservices();

  // Start the HTTP server
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
