import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    LambdaClient,
    CreateFunctionCommand,
    InvokeCommand,
    UpdateFunctionCodeCommand,
    GetFunctionCommand,
} from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { exec } from 'child_process';

import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';

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
        const baseTempDir = '/tmp';
        const uniqueDirName = `python-lambda-${Date.now()}`;
        const tempDir = path.join(baseTempDir, uniqueDirName);
        await fs.promises.mkdir(tempDir, { recursive: true });
        this.logger.debug(`Temporary directory created: ${tempDir}`);
        return tempDir;
    }

    async createZipFile(scriptId: string): Promise<string> {
        const script = await this.toolsRepo.findOne({ where: { toolId: scriptId } });
        if (!script) {
            throw new Error('Script not found');
        }

        const tempDir = await this.createTempDir();
        const tempDepsDir = path.join(tempDir, 'python'); // Dependencies folder
        await fs.promises.mkdir(tempDepsDir, { recursive: true });

        // Write main.py
        const mainPyContent = `
import json

# Dynamically inserted Python code
${script.code}

def lambda_handler(event, context):
    try:
        input_vars = event.get('input_variables', {})
        result = main(**input_vars)
        return {'statusCode': 200, 'body': json.dumps({'result': result})}
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
    `;
        await fs.promises.writeFile(path.join(tempDir, 'main.py'), mainPyContent);

        // Write requirements.txt
        const requirementsPath = path.join(tempDir, 'requirements.txt');
        await fs.promises.writeFile(requirementsPath, script.requirements);

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

    async checkFunctionExists(functionName: string): Promise<boolean> {
        try {
            await this.lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
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
                    new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zipContent })
                );
            } else {
                this.logger.debug(`Creating new function: ${functionName}`);
                await this.lambda.send(
                    new CreateFunctionCommand({
                        FunctionName: functionName,
                        Runtime: 'python3.12',
                        Role: process.env.LAMBDA_ROLE_ARN,
                        Handler: 'main.lambda_handler',
                        Code: { ZipFile: zipContent },
                        Timeout: 30,
                        MemorySize: 128,
                    })
                );
            }

            tool.functionIdentifier = functionName;
            await this.toolsRepo.save(tool);
            return functionName;
        } catch (error) {
            this.logger.error(`Error deploying Lambda: ${error.message}`, error.stack);
            throw new Error(`Failed to deploy Lambda: ${error.message}`);
        } finally {
            await fs.promises.rm(path.dirname(zipPath), { recursive: true, force: true });
        }
    }

    async invokeLambda(toolId: string, input: any): Promise<any> {
        const tool = await this.toolsRepo.findOne({ where: { toolId: toolId } });
        if (!tool) {
            throw new Error('Tool not found');
        }

        const functionName = `agentTool-python-${tool.toolId}`;
        if (!await this.checkFunctionExists(functionName)) {
            await this.deployLambda(toolId);
        }

        //if the tool.toolCategory is equal to 'SALESFORCE' then we need to add the salesforce token to the input
        // if (tool.category.toolCategoryId === 'SALESFORCE') {
        // input.sf_access_token = process.env.SALESFORCE_TOKEN;
        // input.sf_instance_url = process.env.SALESFORCE_INSTANCE_URL;
        // this.logger.debug(`Salesforce token added to input`);
        // }

        try {
            const response = await this.lambda.send(
                new InvokeCommand({
                    FunctionName: functionName,
                    Payload: Buffer.from(JSON.stringify({ input_variables: input })),
                })
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
}
