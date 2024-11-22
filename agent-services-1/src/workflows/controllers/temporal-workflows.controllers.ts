// src/controllers/temporalWorkflows.controller.ts

import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { TemporalWorkflowsService } from '../services/temporal-workflows.service';

@Controller('temporalWorkflows')
export class TemporalWorkflowsController {
    constructor(private readonly temporalWorkflowsService: TemporalWorkflowsService) { }

    @Post()
    async triggerWorkflow(
        @Body() input: { a: number; b: number; c: number }
    ) {
        const { a, b, c } = input;

        try {
            const message = await this.temporalWorkflowsService.startSimpleMathWorkflow(a, b, c);
            return { message };
        } catch (error) {
            throw new HttpException(
                `Failed to trigger workflow: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
