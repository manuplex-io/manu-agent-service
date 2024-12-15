import { Injectable, Logger, BadRequestException, ValidationPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    LambdaClient,
    CreateFunctionCommand,
    InvokeCommand,
    GetFunctionCommand,
    UpdateFunctionCodeCommand,
    UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { exec } from 'child_process';
import Ajv from 'ajv'; // JSON schema validation

import { OB1AgentTools } from '../../entities/ob1-agent-tools.entity';
import { OB1AgentToolExecutionLog } from '../../entities/ob1-agent-toolExecutionLog.entity';

import { OB1Tool } from '../../interfaces/tools.interface';
import { OB1Lambda } from 'src/tools/interfaces/Lambda.interface';

@Injectable()
export class PythonLambdaV1Service {
    private readonly lambda: LambdaClient;
    private readonly logger = new Logger(PythonLambdaV1Service.name);
    private readonly ajvWithWhitlist = new Ajv({ allErrors: true, removeAdditional: 'all' });

    constructor(
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>,
        @InjectRepository(OB1AgentToolExecutionLog) private executionLogRepo: Repository<OB1AgentToolExecutionLog>,
    ) {
        this.lambda = new LambdaClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });
    }

    // Private method to parse JSON content
    private tryParseJSON(content: string): any {
        try {
            return JSON.parse(content);
        } catch (error) {
            return content;
        }
    }

    private generateLambdaName(toolExternalName: string): string {
        const env = process.env.ENV || 'local'; // Default to 'local' if ENV is not set
        if (env === 'local' || env === 'localhost') {
            const localUser = process.env.LOCAL_USER || 'unknown-user'; // Default to 'unknown-user' if LOCAL_USER is not set
            return `${env}-${localUser}-${toolExternalName}`;
        }
        return `${env}-${toolExternalName}`;
    }


    async createTempDir(): Promise<string> {
        const baseTempDir = '/tmp';
        const uniqueDirName = `python-lambda-${Date.now()}`;
        const tempDir = path.join(baseTempDir, uniqueDirName);
        await fs.promises.mkdir(tempDir, { recursive: true });
        this.logger.debug(`Temporary directory created: ${tempDir}`);
        return tempDir;
    }




    // Validate the user code before deployment
    async validateLambdaCode(preSaveToolRequest: {
        toolName: OB1AgentTools['toolName'];
        toolCode: OB1AgentTools['toolCode'];
        toolPythonRequirements: OB1AgentTools['toolPythonRequirements'];
    }): Promise<void> {

        this.logger.debug(`Validating Python code for tool before saving: ${preSaveToolRequest.toolName}`);
        const tempDir = await this.createTempDir();
        const depsDir = path.join(tempDir, 'deps');

        // Minimal main.py content for validation
        const mainPyContent = `
import json
import traceback
import os

${preSaveToolRequest.toolCode}

def lambda_handler(event, context):
    # Minimal handler for test
    try:
        return {'statusCode': 200, 'body': json.dumps({'test': 'ok'})}
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'type': e.__class__.__name__,
                'stackTrace': traceback.format_exc()
            })
        }
`;

        const mainFile = path.join(tempDir, 'main.py');
        await fs.promises.writeFile(mainFile, mainPyContent);

        const requirementsPath = path.join(tempDir, 'requirements.txt');
        await fs.promises.writeFile(requirementsPath, preSaveToolRequest.toolPythonRequirements || '');

        // Check syntax
        await new Promise((resolve, reject) => {
            exec(`python3 -m py_compile ${mainFile}`, (error) => {
                if (error) {
                    return reject(new Error(`Syntax error: ${error.message}`));
                }
                resolve(true);
            });
        });

        // Install dependencies
        await new Promise((resolve, reject) => {
            exec(`pip3 install -r ${requirementsPath} -t ${depsDir}`, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`Dependency installation failed: ${stderr}`));
                }
                resolve(true);
            });
        });

        // Test run
        await new Promise((resolve, reject) => {
            // Attempt a simple test run of lambda_handler
            exec(`python3 -c "import sys; sys.path.insert(0, '${depsDir}'); sys.path.insert(0, '${tempDir}'); import main; print(main.lambda_handler({}, {}))"`, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`Test run failed: ${stderr}`));
                }
                // Check output if needed
                resolve(true);
            });
        });

        this.logger.debug(`Python code validated successfully: ${preSaveToolRequest.toolName}, cleaning up...`);

        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    async validateLambda(toolId: string): Promise<void> {
        const tool = await this.toolsRepo.findOne({ where: { toolId: toolId } });
        if (!tool) {
            throw new Error('Tool not found');
        }

        // Validate the Python code
        await this.validateLambdaCode({
            toolName: tool.toolName,
            toolCode: tool.toolCode,
            toolPythonRequirements: tool.toolPythonRequirements,
        });

        // Validate the input schema if provided
        if (tool.toolInputSchema && Object.keys(tool.toolInputSchema).length > 0) {
            this.logger.debug(`Validating input schema for tool: ${tool.toolId}`);
            this.ajvWithWhitlist.compile(tool.toolInputSchema);
        }

        // Validate the environment variable schema if provided
        if (tool.toolENVInputSchema && Object.keys(tool.toolENVInputSchema).length > 0) {
            this.logger.debug(`Validating environment variable schema for tool: ${tool.toolId}`);
            this.ajvWithWhitlist.compile(tool.toolENVInputSchema);
        }
    }


    async createZipFileForDeploy(tool: OB1AgentTools): Promise<string> {

        const tempDir = await this.createTempDir();
        const tempDepsDir = path.join(tempDir, 'python'); // Dependencies folder
        await fs.promises.mkdir(tempDepsDir, { recursive: true });

        // Updated main.py template to handle env_variables
        const mainPyContent = `
import json
import traceback
import os

${tool.toolCode}

def lambda_handler(event, context):
    # Set environment variables from event if provided
    env_vars = event.get('env_variables', {})
    for key, value in env_vars.items():
        os.environ[key] = str(value)

    try:
        input_vars = event.get('input_variables', {})
        result = main(**input_vars)
        return {'statusCode': 200, 'body': json.dumps({'result': result})}
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'type': e.__class__.__name__,
                'stackTrace': traceback.format_exc()
            })
        }
`;
        await fs.promises.writeFile(path.join(tempDir, 'main.py'), mainPyContent);

        // Write requirements.txt
        const requirementsPath = path.join(tempDir, 'requirements.txt');
        await fs.promises.writeFile(requirementsPath, tool.toolPythonRequirements || '');

        // Install dependencies
        await new Promise((resolve, reject) => {
            exec(`pip3 install -r ${requirementsPath} -t ${tempDepsDir}`, (error, stdout, stderr) => {
                if (error) {
                    this.logger.error(`Dependency installation failed: ${stderr}`);
                    return reject(error);
                }
                this.logger.debug(`Dependencies installed successfully.`);
                resolve(true);
            });
        });

        // Create zip file
        const zipPath = path.join(tempDir, 'function.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            const { size } = await fs.promises.stat(zipPath);
            const sizeInMB = (size / (1024 * 1024)).toFixed(2);
            this.logger.debug(`Zip file created: ${zipPath} (${sizeInMB} MB)`);
        });

        archive.on('error', (err) => {
            throw new Error(`Error creating zip file: ${err.message}`);
        });

        archive.pipe(output);
        archive.file(path.join(tempDir, 'main.py'), { name: 'main.py' });
        archive.directory(tempDepsDir, false);
        await archive.finalize();

        return zipPath;
    }

    async checkFunctionExists(lambdaName: string): Promise<boolean> {
        try {
            await this.lambda.send(new GetFunctionCommand({ FunctionName: lambdaName }));
            this.logger.debug(`Function exists: ${lambdaName}`);
            return true;
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                return false;
            }
            throw error;
        }
    }

    async deployLambda(toolId: string): Promise<string> {
        const tool = await this.toolsRepo.findOne({ where: { toolId: toolId } });
        if (!tool) {
            throw new Error('Tool not found in database');
        }

        // Validate code before deployment
        await this.validateLambda(toolId);

        const lambdaName = this.generateLambdaName(tool.toolExternalName);
        this.logger.debug(`Deploying Lambda function: ${lambdaName}`);

        const zipPath = await this.createZipFileForDeploy(tool);
        const zipContent = await fs.promises.readFile(zipPath);

        try {
            // Check if the function exists in Lambda
            const existsInLambda = await this.checkFunctionExists(lambdaName);

            if (existsInLambda) {
                // Update the existing Lambda function
                this.logger.debug(`Lambda function already exists, Updating existing Lambda function: ${lambdaName}`);
                await this.lambda.send(
                    new UpdateFunctionCodeCommand({
                        FunctionName: lambdaName,
                        ZipFile: zipContent,
                    })
                );
                // Optionally update other configuration parameters if needed
                await this.lambda.send(
                    new UpdateFunctionConfigurationCommand({
                        FunctionName: lambdaName,
                        Runtime: tool.toolConfig.toolRuntime || 'python3.13',
                        Role: process.env.LAMBDA_ROLE_ARN,
                        Handler: 'main.lambda_handler',
                        Timeout: tool.toolConfig.toolTimeout || 30,
                        MemorySize: tool.toolConfig.toolMaxMemorySize || 128,
                        // can't update architectures
                    })
                );

                if (tool.toolStatus !== OB1Tool.ToolStatus.DEPLOYED) {
                    tool.toolStatus = OB1Tool.ToolStatus.DEPLOYED;
                    await this.toolsRepo.save(tool);
                }
                this.logger.debug(`Lambda function updated: ${lambdaName}`);
            }
            else {
                // Create a new Lambda function
                this.logger.debug(`Creating new Lambda function: ${lambdaName}`);
                await this.lambda.send(
                    new CreateFunctionCommand({
                        FunctionName: lambdaName,
                        Runtime: tool.toolConfig.toolRuntime || 'python3.13',
                        Role: process.env.LAMBDA_ROLE_ARN,
                        Handler: 'main.lambda_handler',
                        Code: { ZipFile: zipContent },
                        Timeout: tool.toolConfig.toolTimeout || 30,
                        MemorySize: tool.toolConfig.toolMaxMemorySize || 128,
                        Architectures: tool.toolConfig.toolArch ? [tool.toolConfig.toolArch] : ['arm64'],
                    })
                );
                this.logger.debug(`New Lambda function created: ${lambdaName}`);
            }

            // Update tool status in the database
            tool.toolStatus = OB1Tool.ToolStatus.DEPLOYED;
            await this.toolsRepo.save(tool);

            this.logger.debug(`Lambda function deployed: ${lambdaName}`);
            return lambdaName;
        } catch (error) {
            this.logger.log(
                `Error deploying Lambda:\n${JSON.stringify(
                    {
                        message: error.message,
                        stack: error.stack,
                        ...error,
                    },
                    null,
                    2
                )}`
            );
            throw new Error(`Failed to deploy Lambda: ${error.message}`);
        } finally {
            // Clean up temporary zip file
            await fs.promises.rm(path.dirname(zipPath), { recursive: true, force: true });
        }
    }

    private validateSchema(input: any, schema: object, inputDescription: string): void {
        if (schema && Object.keys(schema).length > 0) {
            this.logger.debug(`Validating ${inputDescription} against schema: ${JSON.stringify(schema)}`);

            const validate = this.ajvWithWhitlist.compile(schema);
            const isValid = validate(input);

            if (!isValid) {
                this.logger.error(`Validation errors for ${inputDescription}: ${JSON.stringify(validate.errors)}`);
                throw new BadRequestException(`Invalid ${inputDescription}: ${JSON.stringify(validate.errors)}`);
            }
            // At this point, `input` should only contain keys whitelisted by the schema
            // due to Ajv's removeAdditional setting.
        }
    }

    async invokeLambda(request: {
        toolId: string;
        toolInputVariables: Record<string, any>;
        toolENVInputVariables: Record<string, any>
    }): Promise<any> {
        const tool = await this.toolsRepo.findOne({ where: { toolId: request.toolId } });
        if (!tool) {
            throw new Error('Tool not found');
        }

        const lambdaName = this.generateLambdaName(tool.toolExternalName);
        if (tool.toolStatus !== OB1Tool.ToolStatus.DEPLOYED) {
            await this.deployLambda(request.toolId);
        }
        this.logger.debug(`5. ToolENV recieved: \n${JSON.stringify(request.toolENVInputVariables, null, 2)}`);
        this.logger.debug(`6. ToolInput recieved: \n${JSON.stringify(request.toolInputVariables, null, 2)}`);
        // Validate environment variables if a schema is provided
        if (tool.toolENVInputSchema && Object.keys(tool.toolENVInputSchema).length > 0) {
            this.validateSchema(request.toolENVInputVariables, tool.toolENVInputSchema, 'environment variable input');
        }


        // Validate tool input if a schema is provided
        if (tool.toolInputSchema && Object.keys(tool.toolInputSchema).length > 0) {
            this.validateSchema(request.toolInputVariables, tool.toolInputSchema, 'tool input');
        }

        // Invoke Lambda function, passing env_variables and input_variables in event
        try {
            const payload = {
                input_variables: request.toolInputVariables,
                env_variables: request.toolENVInputVariables,
            };

            this.logger.debug(`7. Lambda Payload: \n${JSON.stringify(payload, null, 2)}`);

            const response = await this.lambda.send(
                new InvokeCommand({
                    FunctionName: lambdaName,
                    Payload: Buffer.from(JSON.stringify(payload)),
                }),
            );

            if (response.FunctionError) {
                throw new Error(`Lambda execution failed: ${response.FunctionError}`);
            }

            return JSON.parse(Buffer.from(response.Payload as Uint8Array).toString());
        } catch (error) {
            this.logger.error(`Error invoking Lambda: ${error.message}`, error.stack);
            throw new Error(`Failed to invoke Lambda: ${error.message}`);
        }
    }

    async executePythonTool(toolPythonRequest: OB1Lambda.Python.ToolRequestV1): Promise<OB1Lambda.Python.ToolResponseV1> {
        const tool = toolPythonRequest.tool;
        const startTime = Date.now();

        try {
            const toolOutput = await this.invokeLambda({
                toolId: tool.toolId,
                toolInputVariables: toolPythonRequest.toolInputVariables,
                // Pass any environment variables needed here:
                toolENVInputVariables: toolPythonRequest.toolENVInputVariables || {}
            });

            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                requestingServiceId: toolPythonRequest.requestingServiceId,
                toolInput: toolPythonRequest.toolInputVariables,
                toolOutput,
                toolSuccess: toolOutput.statusCode === 200,
                toolExecutionTime: executionTime,
                toolErrorMessage: toolOutput.statusCode === 200 ? null : toolOutput.body?.error,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.toolAvgExecutionTime = ((tool.toolAvgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            if (toolOutput.statusCode === 200) {
                tool.toolSuccessRate = ((tool.toolSuccessRate * (tool.toolUseCount - 1)) + 1) / tool.toolUseCount;
            } else {
                tool.toolSuccessRate = (tool.toolSuccessRate * (tool.toolUseCount - 1)) / tool.toolUseCount;
            }

            await this.toolsRepo.save(tool);

            // If success
            if (toolOutput.statusCode === 200) {
                return {
                    toolSuccess: true,
                    toolstatusCodeReturned: toolOutput.statusCode,
                    toolExecutionTime: executionTime,
                    toolResult: this.tryParseJSON(toolOutput.body),
                };
            }

            // If error
            return {
                toolSuccess: false,
                toolExecutionTime: executionTime,
                toolError: {
                    message: toolOutput.body?.error,
                    type: toolOutput.body?.type,
                    stackTrace: toolOutput.body?.stackTrace
                },
                toolResult: null,
                toolstatusCodeReturned: toolOutput.statusCode
            };
        } catch (error) {
            // Log the failed execution
            const executionTime = Date.now() - startTime;
            const log = this.executionLogRepo.create({
                tool,
                requestingServiceId: toolPythonRequest.requestingServiceId,
                toolInput: toolPythonRequest.toolInputVariables || {},
                toolOutput: { error: error.message },
                toolSuccess: false,
                toolExecutionTime: executionTime,
                toolErrorMessage: error.message,
            });
            await this.executionLogRepo.save(log);

            // Update tool statistics
            tool.toolUseCount += 1;
            tool.toolAvgExecutionTime = ((tool.toolAvgExecutionTime * (tool.toolUseCount - 1)) + executionTime) / tool.toolUseCount;
            tool.toolSuccessRate = (tool.toolSuccessRate * (tool.toolUseCount - 1)) / tool.toolUseCount;
            await this.toolsRepo.save(tool);

            return {
                toolResult: null,
                toolSuccess: false,
                toolExecutionTime: executionTime,
                toolError: {
                    message: error.message
                }
            };
        }
    }
}
