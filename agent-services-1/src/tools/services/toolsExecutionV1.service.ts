// src/tools/services/toolsExecutionV1.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { PythonLambdaV1Service } from './toolSpecificService/pythonLambdaV1.service';
import {
    OB1Tool
} from '../interfaces/tools.interface';


@Injectable()
export class ToolsExecutionV1Service {
    constructor(
        private readonly pythonLambdaV1Service: PythonLambdaV1Service,
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
    ) { }

    async deployAnyTool(toolId: string): Promise<{ success: boolean; message?: string; data?: any }> {
        // Fetch the tool from the repository
        const tool = await this.toolsRepo.findOne({ where: { toolId } });

        // Handle the case where the tool is not found
        if (!tool) {
            throw new NotFoundException('Tool not found');
        }

        // Handle tool deployment based on its type
        let deploymentResult;
        switch (tool.toolType) {
            case OB1Tool.ToolType.PYTHON_SCRIPT:
                deploymentResult = await this.pythonLambdaV1Service.deployLambda(toolId);
                break;

            // case ToolType.NODE_JS:
            //     // Example for a Node.js script deployment
            //     deploymentResult = await this.nodeJsDeploymentService.deployNodeTool(toolId);
            //     break;

            // case ToolType.CONTAINERIZED_APP:
            //     // Example for a containerized application deployment
            //     deploymentResult = await this.containerOrchestratorService.deployContainer(toolId);
            //     break;

            default:
                throw new BadRequestException(`Tool type '${tool.toolType}' is not supported`);
        }

        // Return a consistent response structure
        return {
            success: true,
            message: `Tool deployed successfully: ${tool.toolType}`,
            data: deploymentResult,
        };
    }

    async executeAnyTool(toolRequest: OB1Tool.ToolRequest): Promise<OB1Tool.ToolResponse> {
        // Retrieve the tool from the repository
        const retrievedTool = await this.toolsRepo.findOne({ where: { toolId: toolRequest.toolId } });

        // Handle the case where the tool is not found
        if (!retrievedTool) {
            throw new Error('Tool not found');
        }

        // Prepare the request structure for the tool execution
        let toolResponse: OB1Tool.ToolResponse;

        switch (retrievedTool.toolType) {
            case OB1Tool.ToolType.PYTHON_SCRIPT:
                const toolPythonRequest: OB1Tool.ToolPythonRequest = {
                    tool: retrievedTool,
                    toolInput: toolRequest.toolInput,
                    requestingServiceId: toolRequest.requestingServiceId,
                };
                toolResponse = await this.pythonLambdaV1Service.executePythonTool(toolPythonRequest);
                break;

            // case ToolType.NODE_JS:
            //     const toolNodeJsRequest: ToolNodeJsRequest = {
            //         tool: retrievedTool,
            //         toolInput: toolRequest.toolInput,
            //         requestingServiceId: toolRequest.requestingServiceId,
            //     };
            //     toolResponse = await this.nodeJsExecutionService.executeNodeTool(toolNodeJsRequest);
            //     break;

            // case ToolType.CONTAINERIZED_APP:
            //     const toolContainerRequest: ToolContainerRequest = {
            //         tool: retrievedTool,
            //         toolInput: toolRequest.toolInput,
            //         requestingServiceId: toolRequest.requestingServiceId,
            //     };
            //     toolResponse = await this.containerOrchestratorService.executeContainerTool(toolContainerRequest);
            //     break;

            default:
                throw new Error(`Tool type '${retrievedTool.toolType}' is not supported`);
        }

        // Return the response
        return toolResponse;
    }






}