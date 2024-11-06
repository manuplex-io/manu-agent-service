import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentTools } from '../../entities/ob1-agent-tools.entity';
import {
    LambdaClient,
    CreateFunctionCommand,
    InvokeCommand,
    UpdateFunctionCodeCommand,
    GetFunctionCommand,
} from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as archiver from 'archiver';

@Injectable()
export class PythonLambdaService {
    private readonly lambda: LambdaClient;
    private readonly logger = new Logger(PythonLambdaService.name);

    constructor(
        @InjectRepository(OB1AgentTools) private toolsRepo: Repository<OB1AgentTools>
    ) {
        this.lambda = new LambdaClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });
    }

    async createTempDir(): Promise<string> {
        const tempDir = path.join(os.tmpdir(), `python-lambda-${Date.now()}`);
        await fs.promises.mkdir(tempDir);
        return tempDir;
    }

    async createZipFile(scriptId: string): Promise<string> {
        const script = await this.toolsRepo.findOne({ where: { toolId: scriptId } });
        if (!script) {
            throw new Error('Script not found');
        }

        const tempDir = await this.createTempDir();

        // Create main.py
        const mainPyContent = `
import json
import sys

# Dynamically inserted Python code
${script.code}

def lambda_handler(event, context):
    try:

        # Get input variables from event
        input_vars = event.get('input_variables', {})

        # Execute the code with input variables
        result = main(**input_vars)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'result': result
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
`;


        await fs.promises.writeFile(path.join(tempDir, 'main.py'), mainPyContent);

        // Create requirements.txt
        await fs.promises.writeFile(
            path.join(tempDir, 'requirements.txt'),
            script.requirements
        );

        // Create zip file
        const zipPath = path.join(tempDir, 'function.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip');

        archive.pipe(output);
        archive.directory(tempDir, false);
        await archive.finalize();

        return zipPath;
    }

    // private getFunctionName(toolId: string): string {
    //     // Make function name shorter and more predictable
    //     return `python-tool-${toolId.split('-')[0]}`;
    // }

    async checkFunctionExists(functionName: string): Promise<boolean> {
        try {
            await this.lambda.send(new GetFunctionCommand({
                FunctionName: functionName
            }));
            this.logger.debug(`Function exists: ${functionName}`);
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

        const functionName = `agentTool-python-${tool.toolId}`;
        this.logger.debug(`Deploying function: ${functionName}`);

        const zipPath = await this.createZipFile(toolId);
        const zipContent = await fs.promises.readFile(zipPath);

        try {
            const exists = await this.checkFunctionExists(functionName);

            if (exists) {
                this.logger.debug(`Updating existing function: ${functionName}`);
                await this.lambda.send(
                    new UpdateFunctionCodeCommand({
                        FunctionName: functionName,
                        ZipFile: zipContent,
                    })
                );
            } else {
                this.logger.debug(`Creating new function: ${functionName}`);
                await this.lambda.send(
                    new CreateFunctionCommand({
                        FunctionName: functionName,
                        Runtime: 'python3.12',
                        Role: process.env.LAMBDA_ROLE_ARN,
                        Handler: 'main.lambda_handler',
                        Code: {
                            ZipFile: zipContent,
                        },
                        Timeout: 30,
                        MemorySize: 128,
                    })
                );
            }

            // Update the functionIdentifier in the database
            tool.functionIdentifier = functionName;
            await this.toolsRepo.save(tool);

            // Cleanup
            await fs.promises.rm(path.dirname(zipPath), { recursive: true });

            return functionName;
        } catch (error) {
            this.logger.error(`Error deploying Lambda: ${error.message}`, error.stack);
            throw new Error(`Failed to deploy Lambda: ${error.message}`);
        }
    }

    async invokeLambda(toolId: string, input: any): Promise<any> {
        const tool = await this.toolsRepo.findOne({ where: { toolId: toolId } });
        if (!tool) {
            throw new Error('Tool not found');
        }

        // create function name
        const functionName = `agentTool-python-${tool.toolId}`;

        // Check if function exists
        const exists = await this.checkFunctionExists(functionName);
        if (!exists) {
            await this.deployLambda(toolId);
        }

        try {

            const response = await this.lambda.send(
                new InvokeCommand({
                    FunctionName: functionName,
                    Payload: Buffer.from(
                        JSON.stringify({
                            input_variables: input,
                        })
                    ),
                })
            );

            if (response.FunctionError) {
                throw new Error(`Lambda execution failed: ${response.FunctionError}`);
            }

            const result = JSON.parse(
                Buffer.from(response.Payload as Uint8Array).toString()
            );

            if (result.errorMessage) {
                throw new Error(`Lambda error: ${result.errorMessage}`);
            }

            return result;
        } catch (error) {
            this.logger.error(`Error invoking Lambda: ${error.message}`, error.stack);
            throw new Error(`Failed to invoke Lambda: ${error.message}`);
        }
    }
}
