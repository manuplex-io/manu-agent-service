// src/workflows/services/activityRunnerV1.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Worker, MessageChannel, MessagePort } from 'worker_threads';
import * as ts from 'typescript';
import { join } from 'path';
import { ActivityRepositoryServiceV1 } from './activityRepositoryV1.service';
import { OB1AgentActivity } from '../../entities/ob1-agent-activity.entity';
import { ActivityExecutionError, ActivityInputValidationError } from '../../exceptions/activity.exception';


export interface ActivityExecutionOptions {
    timeout?: number;           // in milliseconds
    memoryLimit?: number;       // in MB
    logging?: {
        enabled: boolean;
        level?: 'debug' | 'info' | 'warn' | 'error';
        capture?: boolean;
    };
}

@Injectable()
export class ActivityRunnerServiceV1 {
    private readonly logger = new Logger(ActivityRunnerServiceV1.name);
    private readonly defaultOptions: ActivityExecutionOptions = {
        timeout: 5000,
        memoryLimit: 128,
        logging: {
            enabled: true,
            level: 'info',
            capture: false
        }
    };

    constructor(
        private readonly activityRepository: ActivityRepositoryServiceV1
    ) { }

    async executeActivity(
        activityId: string,
        input: Record<string, any>,
        options?: ActivityExecutionOptions
    ): Promise<Record<string, any>> {
        const activity = await this.activityRepository.getActivity(activityId);
        const executionOptions = { ...this.defaultOptions, ...options };
        const startTime = Date.now();
        const logs: string[] = [];

        let worker: Worker | undefined;

        try {
            // Validate input against schema if defined
            if (activity.activityInputSchema) {
                await this.validateInput(input, activity.activityInputSchema);
            }

            const result = await this.executeTypeScriptActivity(
                activity,
                input,
                executionOptions,
                logs
            );

            const executionTime = Date.now() - startTime;
            await this.activityRepository.updateActivityMetrics(
                activityId,
                executionTime,
                true
            );

            return {
                data: result,
                metrics: {
                    executionTime,
                    memoryUsage: process.memoryUsage().heapUsed,
                    ...(executionOptions.logging?.capture && { logs })
                }
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            await this.activityRepository.updateActivityMetrics(
                activityId,
                executionTime,
                false
            );

            // Clean up worker if it exists
            if (worker) {
                try {
                    worker.terminate();
                } catch (terminateError) {
                    this.logger.error(`Error terminating worker: ${terminateError.message}`);
                }
            }

            // Transform error to appropriate type
            if (error instanceof ActivityInputValidationError) {
                throw error;
            }

            throw new ActivityExecutionError(
                'Activity execution failed',
                {
                    activityId,
                    error: error.message,
                    stack: error.stack
                },
                executionOptions.logging?.capture ? logs : undefined
            );
        }
    }

    private async executeTypeScriptActivity(
        activity: OB1AgentActivity,
        input: Record<string, any>,
        options: ActivityExecutionOptions,
        logs: string[]
    ): Promise<any> {
        if (!activity.activityCode) {
            throw new Error('No TypeScript activityCode provided for activity');
        }

        // Compile TypeScript to JavaScript
        const result = ts.transpileModule(activity.activityCode, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true,
                strict: true,
            }
        });

        return new Promise((resolve, reject) => {
            const worker = new Worker(
                `
                const { parentPort } = require('worker_threads');

                // Setup error handling
                process.on('uncaughtException', (error) => {
                    parentPort.postMessage({ 
                        type: 'error',
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                });

                // Setup console logging
                const logLevels = ['debug', 'info', 'warn', 'error'];
                const selectedLevelIndex = logLevels.indexOf('${options.logging?.level || 'info'}');

                if (${options.logging?.enabled}) {
                    for (const level of logLevels) {
                        console[level] = (...args) => {
                            const levelIndex = logLevels.indexOf(level);
                            if (levelIndex >= selectedLevelIndex) {
                                const message = args
                                    .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                                    .join(' ');
                                parentPort.postMessage({ type: 'log', level, message });
                            }
                        };
                    }
                }

                // Add the activity activityCode
                ${result.outputText}

                // Execute the activity
                async function executeActivity() {
                    try {
                        if (typeof module.exports.default !== 'function') {
                            throw new Error('Activity must export a default function');
                        }

                        const activityInput = ${JSON.stringify(input)};
                        const activityConfig = ${JSON.stringify(activity.activityConfig)};

                        // Input type validation
                        Object.entries(activityInput).forEach(([key, value]) => {
                            if (value === undefined || value === null) {
                                throw new Error(\`Required input parameter '\${key}' is missing\`);
                            }
                            if (typeof value !== typeof activityInput[key]) {
                                throw new Error(\`Input parameter '\${key}' has invalid type\`);
                            }
                        });

                        const result = await module.exports.default(activityInput, activityConfig);

                        // Validate result is serializable
                        JSON.stringify(result);

                        parentPort.postMessage({ type: 'result', data: result });
                    } catch (error) {
                        parentPort.postMessage({ 
                            type: 'error',
                            error: {
                                message: error.message,
                                stack: error.stack
                            }
                        });
                    }
                }

                executeActivity().catch(error => {
                    parentPort.postMessage({ 
                        type: 'error',
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                });
                `,
                { eval: true }
            );

            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new ActivityExecutionError('Activity execution timed out', {
                    timeout: options.timeout
                }));
            }, options.timeout);

            worker.on('message', (message) => {
                switch (message.type) {
                    case 'log':
                        this.logger.log(`[${message.level}] ${message.message}`);
                        if (options.logging?.capture) {
                            logs.push(`[${message.level}] ${message.message}`);
                        }
                        break;
                    case 'error':
                        clearTimeout(timeout);
                        worker.terminate();
                        reject(new ActivityExecutionError(message.error.message, {
                            stack: message.error.stack
                        }));
                        break;
                    case 'result':
                        clearTimeout(timeout);
                        worker.terminate();
                        resolve(message.data);
                        break;
                }
            });

            worker.on('error', (error) => {
                clearTimeout(timeout);
                worker.terminate();
                reject(new ActivityExecutionError('Worker error', {
                    error: error.message,
                    stack: error.stack
                }));
            });

            worker.on('exit', (activityCode) => {
                clearTimeout(timeout);
                if (activityCode !== 0) {
                    reject(new ActivityExecutionError(`Worker stopped with exit activityCode ${activityCode}`));
                }
            });
        });
    }

    private async validateInput(input: any, schema: Record<string, any>): Promise<void> {
        try {
            // Add your schema validation logic here
            // For example, using ajv or other validation library
            const validationErrors: string[] = [];

            // Check required fields
            if (schema.required) {
                for (const field of schema.required) {
                    if (!(field in input)) {
                        validationErrors.push(`Missing required field: ${field}`);
                    }
                }
            }

            // Check types
            if (schema.properties) {
                for (const [field, def] of Object.entries<any>(schema.properties)) {
                    if (field in input) {
                        const value = input[field];
                        if (def.type === 'number' && typeof value !== 'number') {
                            validationErrors.push(`Field ${field} must be a number`);
                        }
                        // Add more type validations as needed
                    }
                }
            }

            if (validationErrors.length > 0) {
                throw new ActivityInputValidationError(
                    'Input validation failed',
                    validationErrors
                );
            }
        } catch (error) {
            if (error instanceof ActivityInputValidationError) {
                throw error;
            }
            throw new ActivityInputValidationError(
                'Input validation failed',
                [error.message]
            );
        }
    }

    private createWorker(
        activityCode: string,
        input: Record<string, any>,
        config: Record<string, any>,
        options: ActivityExecutionOptions,
        logs: string[]
    ): Worker {
        // Create the worker activityCode
        const workerCode = `
            const { parentPort } = require('worker_threads');

            // Setup console logging
            const originalConsole = { ...console };
            const logLevels = ['debug', 'info', 'warn', 'error'];
            const selectedLevelIndex = logLevels.indexOf('${options.logging?.level || 'info'}');

            if (${options.logging?.enabled}) {
                for (const level of logLevels) {
                    console[level] = (...args) => {
                        const levelIndex = logLevels.indexOf(level);
                        if (levelIndex >= selectedLevelIndex) {
                            const message = args
                                .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                                .join(' ');
                            parentPort.postMessage({ type: 'log', level, message });
                        }
                    };
                }
            }

            // Add the activity activityCode
            ${activityCode}

            // Execute the activity
            async function executeActivity() {
                try {
                    if (typeof module.exports.default !== 'function') {
                        throw new Error('Activity must export a default function');
                    }

                    const result = await module.exports.default(
                        ${JSON.stringify(input)},
                        ${JSON.stringify(config)}
                    );

                    // Validate result is serializable
                    JSON.stringify(result);

                    parentPort.postMessage({ type: 'result', data: result });
                } catch (error) {
                    parentPort.postMessage({ 
                        type: 'error',
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                }
            }

            executeActivity();
        `;

        // Create the worker
        const worker = new Worker(workerCode, {
            eval: true,
            env: { NODE_OPTIONS: `--max-old-space-size=${options.memoryLimit}` }
        });

        // Handle worker messages
        worker.on('message', (message) => {
            switch (message.type) {
                case 'log':
                    this.logger.log(`[${message.level}] ${message.message}`);
                    if (options.logging?.capture) {
                        logs.push(`[${message.level}] ${message.message}`);
                    }
                    break;
                case 'error':
                    throw new Error(message.error.message);
                case 'result':
                    return message.data;
            }
        });

        return worker;
    }
}