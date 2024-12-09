// src/tools/services/toolsExecutionV1.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';
import { PythonLambdaV1Service } from './toolSpecificService/pythonLambdaV1.service';
import { OB1Tool } from '../interfaces/tools.interface';
import { OB1Lambda } from '../interfaces/Lambda.interface';


@Injectable()
export class ToolsExecutionV1Service {
    private readonly logger = new Logger(ToolsExecutionV1Service.name);
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
                throw new BadRequestException(`Tool type '${tool.toolType}' is not supported for Deployment`);
        }

        // Return a consistent response structure
        return {
            success: true,
            message: `Tool deployed successfully: ${tool.toolType}`,
            data: deploymentResult,
        };
    }

    async validateAnyToolCode(preSaveToolRequest: {
        toolName: OB1AgentTools['toolName'];
        toolCode: OB1AgentTools['toolCode'];
        toolPythonRequirements: OB1AgentTools['toolPythonRequirements'];
        toolType: OB1AgentTools['toolType'];
    }): Promise<{ success: boolean; message?: string; data?: any }> {



        // Handle tool validateion based on its type
        let validationResult;
        switch (preSaveToolRequest.toolType) {
            case OB1Tool.ToolType.PYTHON_SCRIPT:
                validationResult = await this.pythonLambdaV1Service.validateLambdaCode({
                    toolName: preSaveToolRequest.toolName,
                    toolCode: preSaveToolRequest.toolCode,
                    toolPythonRequirements: preSaveToolRequest.toolPythonRequirements,
                });
                break;


            default:
                throw new BadRequestException(`Tool type '${preSaveToolRequest.toolType}' is not supported for Validation`);
        }

        // Return a consistent response structure
        return {
            success: true,
            message: `Tool validated successfully: ${preSaveToolRequest.toolName}`,
            data: validationResult,
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
                const toolPythonRequest: OB1Lambda.Python.ToolRequestV1 = {
                    tool: retrievedTool,
                    toolInputVariables: toolRequest.toolInputVariables,
                    toolInputENVVariables: toolRequest?.toolInputENVVariables,
                    requestingServiceId: toolRequest.requestingServiceId,
                };

                this.logger.log(`2. Tool Request: ${JSON.stringify(toolPythonRequest, null, 2)}`);
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
                throw new Error(`Tool type '${retrievedTool.toolType}' is not supported for execution`);
        }

        // Return the response
        return toolResponse;
    }






}