// /src/workflows/services/workflowLang/workflowTypeScriptV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import Ajv from 'ajv';
import { OB1Workflow } from '../../../interfaces/workflow.interface';
import { Worker, NativeConnection, WorkerOptions, DefaultLogger, Runtime } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Connection, WorkflowClient, WorkflowHandle } from '@temporalio/client';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OB1AgentActivities } from 'src/activity/entities/ob1-agent-activities.entity';
import {OB1AgentWorkflows} from '../../../entities/ob1-agent-workflows.entity';
import { TSValidationOb1Service } from '../../../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
import { OB1TSValidation } from 'src/aa-common/ts-validation-ob1/interfaces/ts-validation-ob1.interface';
@Injectable()
export class WorkflowTestingTypeScriptV1Service {
    private readonly logger = new Logger(WorkflowTestingTypeScriptV1Service.name);

    constructor(
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }
    /**
     * Validate a workflow object before saving it.
     */
    async validateAndCleanWorkflow(workflow: OB1Workflow.ValidateWorkflow): Promise<OB1Workflow.ValidateWorkflowRespose> {
        try {
            const processedWorkflows = new Set<string>();
            const uniqueImports = new Set<string>();
            const uniqueActivityNames = new Set<string>();
            let mergedActivityCode = '';
            
            const mergedENVinputSchema = {
                type: 'object',
                properties: {},
                required: [] as string[]
            };

            // CODE CLEANUP - Series of code cleanup steps before validation
            const codeCleanup1 = this.tsValidationOb1Service.updateConfigInputToOptionalIfUnused(workflow.workflowCode);
            if (codeCleanup1 !== workflow.workflowCode) {
                workflow.workflowCode = codeCleanup1;
            }

            // Process direct activities first (from the current workflow)
            const activities = await this.activityRepository.find({
                where: { activityId: In(workflow.activitiesUsedByWorkflow) },
            });

            for (const activity of activities) {
                const activityCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                    sourceCode: activity.activityCode,
                    newFunctionName: activity.activityExternalName,
                    functionType: OB1TSValidation.FunctionType.ACTIVITY
                });
                if(!uniqueActivityNames.has(activity.activityExternalName)){
                    mergedActivityCode += activityCode + '\n';
                    uniqueActivityNames.add(activity.activityExternalName);
                }
                if (activity.activityENVInputSchema) {
                    mergedENVinputSchema.properties = {
                        ...mergedENVinputSchema.properties,
                        ...activity.activityENVInputSchema.properties
                    };
                    if (activity.activityENVInputSchema.required) {
                        mergedENVinputSchema.required = [
                            ...new Set([
                                ...mergedENVinputSchema.required,
                                ...activity.activityENVInputSchema.required
                            ])
                        ];
                    }
                }

                if (activity.activityImports) {
                    activity.activityImports.forEach(imp => uniqueImports.add(imp));
                }
            }

            // Then process subworkflows
            const workflowQueue: OB1AgentWorkflows[] = [...(workflow.subWorkflows || [])];
            
            while (workflowQueue.length > 0) {
                const currentWorkflow = workflowQueue.shift()!;
                
                if (processedWorkflows.has(currentWorkflow.workflowId)) {
                    continue;
                }
                processedWorkflows.add(currentWorkflow.workflowId);

                for (const workflowActivity of currentWorkflow.workflowActivities) {
                    if (workflowActivity.activity) {
                        const activity = workflowActivity.activity;
                        const activityCode = this.tsValidationOb1Service.replaceFunctionNameAndDefaultForExecution({
                            sourceCode: activity.activityCode,
                            newFunctionName: activity.activityExternalName,
                            functionType: OB1TSValidation.FunctionType.ACTIVITY
                        });

                        if(!uniqueActivityNames.has(activity.activityExternalName)){
                            mergedActivityCode += activityCode + '\n';
                            uniqueActivityNames.add(activity.activityExternalName);
                        }

                        if (activity.activityENVInputSchema) {
                            mergedENVinputSchema.properties = {
                                ...mergedENVinputSchema.properties,
                                ...activity.activityENVInputSchema.properties
                            };
                            if (activity.activityENVInputSchema.required) {
                                mergedENVinputSchema.required = [
                                    ...new Set([
                                        ...mergedENVinputSchema.required,
                                        ...activity.activityENVInputSchema.required
                                    ])
                                ];
                            }
                        }

                        if (activity.activityImports) {
                            activity.activityImports.forEach(imp => uniqueImports.add(imp));
                        }
                    }

                    if (workflowActivity.subWorkflow && !processedWorkflows.has(workflowActivity.subWorkflow.workflowId)) {
                        workflowQueue.push(workflowActivity.subWorkflow);
                    }
                }
            }
            // Validate and consolidate imports
            let updatedWorkflowCode = this.tsValidationOb1Service.validateAndConsolidateWorkflowImports(workflow.workflowCode);
            updatedWorkflowCode = this.tsValidationOb1Service.validateAndConsolidateActivityImports(
                updatedWorkflowCode, 
                Array.from(uniqueActivityNames)
            );

            // Run all validations
            await Promise.all([
                this.validateTypeScriptCode(updatedWorkflowCode),
                this.validateTypeCompliance(updatedWorkflowCode, workflow.workflowInputSchema, workflow.workflowOutputSchema),
                workflow.workflowImports && this.validateExternalImports(workflow.workflowImports),
                this.validateActivityImportStatement(updatedWorkflowCode),
                this.validateExternalActivityandMyWorkflowCompliance({
                    ...workflow,
                    workflowCode: updatedWorkflowCode
                })
            ]);

            // Final compilation check
            await this.tsValidationOb1Service.compileTypeScriptCheckForWorkflowExecution(
                updatedWorkflowCode, 
                mergedActivityCode
            );

            this.logger.debug('Workflow validation completed successfully.');
            return {
                workflowCode: updatedWorkflowCode,
            };
        } catch (error) {
            this.logger.error('Workflow validation failed:', error);
            throw new BadRequestException({
                message: 'Workflow validation failed',
                details: error.message,
                error
            });
        }
    }

    /**
     * Validate TypeScript code for syntax and structure.
     */
    private async validateTypeScriptCode(workflowCode: string): Promise<void> {
        if (!workflowCode) {
            this.logger.error('Validation failed: TypeScript workflowCode cannot be empty');
            throw new BadRequestException('TypeScript workflowCode cannot be empty');
        }

        const transpileResult = ts.transpileModule(workflowCode, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                strict: true,
                noImplicitAny: true,
                noImplicitReturns: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                esModuleInterop: true,
            },
        });

        const diagnostics = transpileResult.diagnostics;

        if (diagnostics && diagnostics.length > 0) {
            const errors = diagnostics.map((diagnostic) => {
                let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    message = `Line ${line + 1}, Column ${character + 1}: ${message}`;
                }
                return message;
            });

            this.logger.error('TypeScript code syntax validation failed', JSON.stringify(errors));
            throw new BadRequestException({
                message: 'TypeScript workflowCode syntax validation failed',
                errors,
            });
        }

        this.logger.debug('Validating the structure of the workflow code...');
        await this.validateTypeScriptCodeStructure(workflowCode);
        this.logger.debug('Workflow code validated successfully.');
    }

    async validateExternalActivityandMyWorkflowCompliance(workflow: {
        workflowCode: string;
        workflowInputSchema: Record<string, any>;
        workflowOutputSchema: Record<string, any>;
        workflowImports?: string[];
        activitiesUsedByWorkflow: string[];
    }): Promise<void> {
        // Step 1: Build activitiesUsedByWorkflowExternalNames[]
        const activityIds = workflow.activitiesUsedByWorkflow;
        const activities = await this.activityRepository.find({
            where: { activityId: In(activityIds) },
            select: ['activityExternalName'],
        });

        const activitiesUsedByWorkflowExternalNames = activities.map(
            (activity) => activity.activityExternalName,
        );

        // Step 2: Parse the workflowCode
        const sourceFile = ts.createSourceFile(
            'workflow.ts',
            workflow.workflowCode,
            ts.ScriptTarget.ES2020,
            true,
            ts.ScriptKind.TS,
        );

        // Variables to hold collected data
        let defaultExportFunctionName: string | null = null;
        let myWorkflowFunctionNode: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | null = null;
        const proxyActivityNames: string[] = [];
        const calledFunctionNames: Set<string> = new Set();
        const otherFunctionNames: Set<string> = new Set();

        // Function to find the default exported function
        function findDefaultExportedFunction(node: ts.Node) {
            if (ts.isFunctionDeclaration(node) && node.modifiers) {
                const isExport = node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
                const isDefault = node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
                if (isExport && isDefault) {
                    defaultExportFunctionName = node.name ? node.name.text : null;
                    if (defaultExportFunctionName === 'myWorkflow') {
                        myWorkflowFunctionNode = node;
                    }
                }
            } else if (ts.isExportAssignment(node)) {
                // Handle 'export default' assignments
                if (ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression)) {
                    const functionExpression = node.expression;
                    if (functionExpression.name && functionExpression.name.text === 'myWorkflow') {
                        defaultExportFunctionName = functionExpression.name.text;
                        myWorkflowFunctionNode = functionExpression;
                    } else {
                        defaultExportFunctionName = 'myWorkflow';
                        myWorkflowFunctionNode = functionExpression;
                    }
                }
            }
            ts.forEachChild(node, findDefaultExportedFunction);
        }

        // Function to find proxyActivities
        function findProxyActivities(node: ts.Node) {
            if (
                ts.isVariableDeclaration(node) &&
                node.initializer &&
                ts.isCallExpression(node.initializer)
            ) {
                const callExpression = node.initializer;
                if (
                    ts.isIdentifier(callExpression.expression) &&
                    callExpression.expression.text === 'proxyActivities'
                ) {
                    // Collect the names of the activities
                    const variableName = node.name;
                    if (ts.isObjectBindingPattern(variableName)) {
                        variableName.elements.forEach((element) => {
                            if (ts.isBindingElement(element)) {
                                const name = element.name;
                                if (ts.isIdentifier(name)) {
                                    proxyActivityNames.push(name.text);
                                }
                            }
                        });
                    } else if (ts.isIdentifier(variableName)) {
                        proxyActivityNames.push(variableName.text);
                    }
                }
            }
            ts.forEachChild(node, findProxyActivities);
        }

        // Function to find function calls in myWorkflow
        function findFunctionCallsInMyWorkflow(node: ts.Node) {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                if (ts.isIdentifier(expression)) {
                    calledFunctionNames.add(expression.text);
                } else if (ts.isPropertyAccessExpression(expression)) {
                    // For calls like object.method()
                    const name = expression.name;
                    if (ts.isIdentifier(name)) {
                        calledFunctionNames.add(name.text);
                    }
                }
            }
            ts.forEachChild(node, findFunctionCallsInMyWorkflow);
        }

        // Function to find other functions
        function findOtherFunctions(node: ts.Node) {
            if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
                const functionName = node.name.text;
                if (functionName !== 'myWorkflow' && !proxyActivityNames.includes(functionName)) {
                    otherFunctionNames.add(functionName);
                }
            } else if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach((declaration) => {
                    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
                        if (
                            ts.isFunctionExpression(declaration.initializer) ||
                            ts.isArrowFunction(declaration.initializer)
                        ) {
                            const name = declaration.name;
                            if (ts.isIdentifier(name)) {
                                const functionName = name.text;
                                if (functionName !== 'myWorkflow' && !proxyActivityNames.includes(functionName)) {
                                    otherFunctionNames.add(functionName);
                                }
                            }
                        }
                    }
                });
            }
            ts.forEachChild(node, findOtherFunctions);
        }

        // Now perform the AST traversal
        findDefaultExportedFunction(sourceFile);
        if (defaultExportFunctionName !== 'myWorkflow') {
            throw new BadRequestException({
                message: 'Workflow code validation failed',
                errors: ['Default exported function must be named "myWorkflow".'],
            });
        }

        // Collect proxy activity names
        findProxyActivities(sourceFile);

        // DEPRECATED - This is no longer needed as we are using the activitiesUsedByWorkflowExternalNames[] to validate the proxyActivities
        // WE FORCE CREATE THE PROXYACTIVITIES IN THE WORKFLOW CODE. 
        // Verify that proxyActivityNames are in activitiesUsedByWorkflowExternalNames[]
        // const invalidActivities = proxyActivityNames.filter(
        //     (name) => !activitiesUsedByWorkflowExternalNames.includes(name),
        // );
        // if (invalidActivities.length > 0) {
        //     throw new BadRequestException({
        //         message: 'Workflow code validation failed',
        //         errors: [
        //             `The following activities are not allowed or not listed in activitiesUsedByWorkflow: ${invalidActivities.join(
        //                 ', ',
        //             )}.`,
        //         ],
        //     });
        // }

        // Find function calls in myWorkflow
        if (myWorkflowFunctionNode) {
            findFunctionCallsInMyWorkflow(myWorkflowFunctionNode);
        } else {
            throw new BadRequestException({
                message: 'Workflow code validation failed',
                errors: ['Could not find the "myWorkflow" function.'],
            });
        }

        // Verify that all called functions are in proxyActivityNames
        const invalidFunctionCalls = [...calledFunctionNames].filter(
            (name) => !proxyActivityNames.includes(name),
        );
        if (invalidFunctionCalls.length > 0) {
            this.logger.debug('Functions found that might cause issue if not properly imported, code currently does not support validating these', JSON.stringify(invalidFunctionCalls));
            // throw new BadRequestException({
            //     message: 'Workflow code validation failed',
            //     errors: [
            //         `The following functions are called but not defined as proxyActivities: ${invalidFunctionCalls.join(
            //             ', ',
            //         )}.`,
            //     ],
            // });
        }

        // Find other functions
        findOtherFunctions(sourceFile);

        // Log other function names
        if (otherFunctionNames.size > 0) {
            this.logger.log(
                `Other functions found in the code: ${[...otherFunctionNames].join(', ')}`,
            );
        }
    }

    /**
     * Validate the structure of the TypeScript workflowCode.
     */
    private async validateTypeScriptCodeStructure(workflowCode: string): Promise<void> {
        this.logger.debug('Workflow code to validate:\n' + workflowCode);

        // Since the code-validator module is not available, we'll perform basic validation
        const sourceFile = ts.createSourceFile('workflow.ts', workflowCode, ts.ScriptTarget.ES2020, true);

        let validationResult = {
            hasDefaultExport: false,
            isAsyncFunction: false,
        };
        const validateNode = (node: ts.Node) => {
            // Check for default export function declaration
            if (
                ts.isFunctionDeclaration(node) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
            ) {
                validationResult.hasDefaultExport = true;
                validationResult.isAsyncFunction = node.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
            }

            // Check for default exported async function expression
            if (
                ts.isExportAssignment(node) &&
                (ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression))
            ) {
                validationResult.hasDefaultExport = true;
                validationResult.isAsyncFunction = node.expression['async'] === true;
            }

            // Check for export default with variable declaration
            if (
                ts.isVariableStatement(node) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
            ) {
                const declaration = node.declarationList.declarations[0];
                if (
                    ts.isIdentifier(declaration.name) &&
                    declaration.name.text === 'default' &&
                    (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer))
                ) {
                    validationResult.hasDefaultExport = true;
                    validationResult.isAsyncFunction = declaration.initializer['async'] === true;
                }
            }

            ts.forEachChild(node, validateNode);
        };


        // const validateNode = (node: ts.Node) => {
        //     if (ts.isExportAssignment(node)) {
        //         validationResult.hasDefaultExport = true;
        //         if (ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression)) {
        //             validationResult.isAsyncFunction = node.expression.modifiers?.some(
        //                 (m) => m.kind === ts.SyntaxKind.AsyncKeyword
        //             ) || node.expression['async'] === true;
        //         }
        //     }

        //     ts.forEachChild(node, validateNode);
        // };

        ts.forEachChild(sourceFile, validateNode);

        const validationErrors: string[] = [];

        if (!validationResult.hasDefaultExport) {
            validationErrors.push('Workflow code must have a default export function.');
        }
        if (!validationResult.isAsyncFunction) {
            validationErrors.push('Default export must be an async function.');
        }

        if (validationErrors.length > 0) {
            this.logger.error('Workflow code structure validation failed', JSON.stringify(validationErrors));
            throw new BadRequestException({
                message: 'Workflow code validation failed',
                errors: validationErrors,
            });
        }
    }

    /**
     * Validate input and output schemas against the workflowCode.
     */
    private async validateTypeCompliance(
        workflowCode: string,
        workflowInputSchema: Record<string, any>,
        workflowOutputSchema: Record<string, any>
    ): Promise<void> {
        // Implement schema compliance checks if necessary
        this.logger.debug('Validating input and output schemas compliance with the workflow code...');
        // This could involve parsing the code to extract type information and comparing with the schemas
        // For now, we'll assume the schemas are valid
    }

    /**
     * Validate external imports are allowed in Temporal workflows.
     */
    private async validateExternalImports(imports: string[]): Promise<void> {
        const disallowedModules = ['fs', 'net', 'child_process', 'http', 'https', 'os', 'cluster'];
        const allowedModules = ['@temporalio/workflow', '@temporalio/activity', 'uuid', 'lodash']; // Extend as needed

        const prohibitedModules = imports.filter((moduleName) => disallowedModules.includes(moduleName));
        if (prohibitedModules.length > 0) {
            this.logger.error('Prohibited modules used in workflow code', JSON.stringify(prohibitedModules));
            throw new BadRequestException({
                message: 'One or more prohibited modules are used in the workflow code.',
                errors: prohibitedModules.map((module) => `Module is disallowed in workflows: ${module}`),
            });
        }

        const unknownModules = imports.filter(
            (moduleName) => !allowedModules.includes(moduleName) && !moduleName.startsWith('.')
        );

        if (unknownModules.length > 0) {
            this.logger.warn('Unknown modules used in workflow code', JSON.stringify(unknownModules));
            // Optionally, you can throw an error or allow with warnings
        }

        this.logger.debug('All external imports validated successfully.');
    }
    private async validateActivityImportStatement(sourceCode: string): Promise<void> {
        // Create source file from the code
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );

        let hasExactImport = false;

        function visit(node: ts.Node) {
            if (ts.isImportDeclaration(node)) {
                const importModuleSpecifier = node.moduleSpecifier;
                const importClause = node.importClause;

                if (
                    importClause?.isTypeOnly &&
                    importClause.namedBindings &&
                    ts.isNamespaceImport(importClause.namedBindings) &&
                    importClause.namedBindings.name.text === 'activities' &&
                    ts.isStringLiteral(importModuleSpecifier) &&
                    importModuleSpecifier.text === './myActivity'
                ) {
                    hasExactImport = true;
                }
            }

            ts.forEachChild(node, visit);
        }

        visit(sourceFile);

        if (!hasExactImport) {
            this.logger.error('Required import activity statement not found');
            throw new BadRequestException({
                message: 'Missing required import statement',
                required: 'import type * as activities from \'./myActivity\''
            });
        }
    }

    /**
     * Test the workflow with the provided workflowInput.
     */
    async testWorkflow(
        workflow: {
            workflowCode: string;
            workflowInputSchema: Record<string, any>;
            workflowOutputSchema: Record<string, any>;
            workflowImports?: string[];
        },
        workflowInput: Record<string, any>
    ): Promise<OB1Workflow.WorkflowTestResponse> {
        const { workflowCode, workflowInputSchema, workflowOutputSchema, workflowImports } = workflow;

        // Step 1: Validate workflowInput against workflowInputSchema
        this.logger.debug('Validating workflowInput against workflowInputSchema...');

        const ajv = new Ajv({ allErrors: true });
        const validateInput = ajv.compile(workflowInputSchema);

        const isValidInput = validateInput(workflowInput);
        const inputValidationErrors =
            validateInput.errors?.map((err) => `${err.instancePath}: ${err.message}`) || [];

        if (!isValidInput) {
            this.logger.error('Validation of workflowInput failed', JSON.stringify(inputValidationErrors));
            throw new BadRequestException({
                message: 'Validation of workflowInput failed',
                errors: inputValidationErrors,
            });
        }

        this.logger.debug('workflowInput validation passed.');

        // Step 2: Set up Temporal testing environment
        this.logger.debug('Setting up Temporal testing environment...');

        const testEnv = await TestWorkflowEnvironment.createTimeSkipping();

        // or .Local() for running in the same process

        let tempDir: string;
        try {
            // Step 3: Write the workflow code to a temporary directory
            tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp-workflow-'));
            const workflowFilePath = path.join(tempDir, 'workflow.ts');
            fs.writeFileSync(workflowFilePath, workflowCode);

            // Step 4: Create a worker and register the workflow
            //const workflowModulePath = path.relative(process.cwd(), workflowFilePath);

            const worker = await Worker.create({
                workflowsPath: tempDir,
                taskQueue: 'test-workflow',
                connection: testEnv.nativeConnection,
                sinks: {},
                // dataConverter: testEnv.dataConverter,
                // Adjust worker options as per the latest interface
            });

            // Step 5: Start the worker
            const workerRunPromise = worker.run();

            // Step 6: Execute the workflow
            const client = testEnv.workflowClient;
            const workflowId = `test-workflow-${randomUUID()}`;

            // We need to import the workflow function dynamically
            const workflowImportPath = path.resolve(workflowFilePath);
            const workflowModule = await import(workflowImportPath);

            const handle: WorkflowHandle = await client.start(workflowModule.default, {
                args: [workflowInput],
                taskQueue: 'test-workflow',
                workflowId,
            });

            const workflowResult = await handle.result();

            // Step 7: Validate workflowResult against workflowOutputSchema
            const validateOutput = ajv.compile(workflowOutputSchema);

            const isValidOutput = validateOutput(workflowResult);
            const outputValidationErrors =
                validateOutput.errors?.map((err) => `${err.instancePath}: ${err.message}`) || [];

            const workflowResponseValidationTestPass = isValidOutput;

            const workflowResponseValidationTestResult = {
                isValid: isValidOutput,
                errors: outputValidationErrors,
            };

            // Stop the worker after the test
            worker.shutdown();
            await workerRunPromise;

            return {
                workflowResult,
                workflowResponseValidationTestResult,
                workflowResponseValidationTestPass,
            };
        } catch (error) {
            this.logger.error('Workflow execution failed', error);
            throw new BadRequestException({
                message: 'Workflow execution failed',
                details: error.message,
            });
        } finally {
            // Cleanup
            await testEnv.teardown();
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}