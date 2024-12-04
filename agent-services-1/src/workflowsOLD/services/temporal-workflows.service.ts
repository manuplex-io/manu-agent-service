// src/services/temporal-workflows.service.ts

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Connection, WorkflowClient } from '@temporalio/client';
import { simpleMathWorkflow } from '../../temporalOLD/workflows/standard/examples';

@Injectable()
export class TemporalWorkflowsService {
    private client: WorkflowClient;

    constructor() {
        // this.initializeClient();
    }

    async initializeClient() {
        const connection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS,
        });

        this.client = new WorkflowClient({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE,
        });
    }

    async startSimpleMathWorkflow(a: number, b: number, c: number): Promise<string> {
        try {
            const handle = await this.client.start(simpleMathWorkflow, {
                taskQueue: 'agentprocess_QUEUE',
                workflowId: `workflow-${Date.now()}`,
                args: [a, b, c],
            });

            return `Workflow started with ID ${handle.workflowId}`;
        } catch (error) {
            throw new HttpException(
                `Failed to start workflow: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
