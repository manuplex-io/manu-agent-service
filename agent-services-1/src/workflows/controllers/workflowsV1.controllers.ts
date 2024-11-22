import { Controller, Get, Post, Put, Delete, Body, Param, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { WorkflowRepositoryServiceV1 } from '../services/workflow/workflowRepositoryV1.service';
import { CreateWorkflowDto, ListWorkflowsDto, UpdateWorkflowDto, UpdateWorkflowMetricsDto, WorkflowResponseDto } from '../interfaces/workflow.interface';

@Controller('api/v1/workflows')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class WorkflowControllerV1 {
    constructor(private workflowService: WorkflowRepositoryServiceV1) { }

    @Post()
    async createWorkflow(@Body() createWorkflowDto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
        return this.workflowService.createWorkflow(createWorkflowDto);
    }

    @Get(':workflowId')
    async getWorkflow(@Param('workflowId') workflowId: string): Promise<WorkflowResponseDto> {
        return this.workflowService.getWorkflow(workflowId);
    }

    @Get()
    async listWorkflows(@Query() filters: ListWorkflowsDto): Promise<WorkflowResponseDto[]> {
        return this.workflowService.listWorkflows(filters);
    }

    @Put(':workflowId')
    async updateWorkflow(
        @Param('workflowId') workflowId: string,
        @Body() updateWorkflowDto: UpdateWorkflowDto
    ): Promise<WorkflowResponseDto> {
        return this.workflowService.updateWorkflow(workflowId, updateWorkflowDto);
    }

    @Delete(':workflowId')
    async deleteWorkflow(@Param('workflowId') workflowId: string): Promise<void> {
        return this.workflowService.deleteWorkflow(workflowId);
    }

    @Post('metrics')
    async updateMetrics(@Body() metricsDto: UpdateWorkflowMetricsDto): Promise<void> {
        return this.workflowService.updateWorkflowMetrics(
            metricsDto.workflowId,
            metricsDto.executionTime
        );
    }
}