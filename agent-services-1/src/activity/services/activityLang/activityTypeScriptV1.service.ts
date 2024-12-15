// /src/activitys/services/activityLang/typescriptV1.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import { ValidationPipe } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import Ajv from 'ajv';
import { OB1Activity } from '../../interfaces/activity.interface';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TSValidationOb1Service } from '../../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';

const execAsync = promisify(exec);


@Injectable()
export class ActivityTypeScriptV1Service {
    private readonly logger = new Logger(ActivityTypeScriptV1Service.name);

    constructor(
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }

    /**
     * Validate an activity object before saving it.
     */
    async validateActivity(activity: {
        activityCode: string;
        activityInputSchema: Record<string, any>;
        activityENVInputSchema?: Record<string, any>;
        activityOutputSchema: Record<string, any>;
        activityImports?: string[];
    }): Promise<void> {
        const { activityCode, activityInputSchema, activityOutputSchema, activityImports, activityENVInputSchema } = activity;

        this.logger.debug('Validating activity before saving...');

        // Validate TypeScript code
        await this.validateTypeScriptCode(activityCode);

        // // Validate input and output schemas
        // await this.validateTypeCompliance(activityCode, activityInputSchema, activityENVInputSchema, activityOutputSchema);

        // Validate external imports
        if (activityImports && activityImports.length > 0) {
            await this.validateExternalImports(activityImports);
        }

        // Validate name is myActivity and log other function names
        await this.validateMyActivityCompliance(activity);

        // const activityENVInputVariables = this.tsValidationOb1Service.extractEnvironmentVariables(activityCode, 'activity');
        // if (activityENVInputVariables || activityENVInputSchema) {
        //     await this.tsValidationOb1Service.validateInputKeysExistInSchema(activityENVInputSchema, activityENVInputVariables, 'activityENVInputSchema');
        // }

        this.logger.debug('Activity validation completed successfully.');
    }

    /**
     * Validate TypeScript code for syntax and structure.
     */
    private async validateTypeScriptCode(activityCode: string): Promise<void> {
        if (!activityCode) {
            this.logger.error('Validation failed: TypeScript activityCode cannot be empty');
            throw new BadRequestException('TypeScript activityCode cannot be empty');
        }

        const transpileResult = ts.transpileModule(activityCode, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                strict: true,
                noImplicitAny: true,
                noImplicitReturns: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
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
                message: 'TypeScript activityCode syntax validation failed',
                errors,
            });
        }

        this.logger.debug('Validating the structure of the activity code...');
        this.validateTypeScriptCodeStructure(activityCode);
        this.logger.debug('Activity code validated successfully.');
    }

    async validateMyActivityCompliance(activity: {
        activityCode: string;
        activityInputSchema: Record<string, any>;
        activityOutputSchema: Record<string, any>;
        activityImports?: string[];
    }): Promise<void> {


        // Step 2: Parse the activityCode
        const sourceFile = ts.createSourceFile(
            'activity.ts',
            activity.activityCode,
            ts.ScriptTarget.ES2020,
            true,
            ts.ScriptKind.TS,
        );

        // Variables to hold collected data
        let defaultExportFunctionName: string | null = null;
        let myActivityFunctionNode: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | null = null;
        const otherFunctionNames: Set<string> = new Set();

        // Function to find the default exported function
        function findDefaultExportedFunction(node: ts.Node) {
            if (ts.isFunctionDeclaration(node) && node.modifiers) {
                const isExport = node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
                const isDefault = node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
                if (isExport && isDefault) {
                    defaultExportFunctionName = node.name ? node.name.text : null;
                    if (defaultExportFunctionName === 'myActivity') {
                        myActivityFunctionNode = node;
                    }
                }
            } else if (ts.isExportAssignment(node)) {
                // Handle 'export default' assignments
                if (ts.isFunctionExpression(node.expression) || ts.isArrowFunction(node.expression)) {
                    const functionExpression = node.expression;
                    if (functionExpression.name && functionExpression.name.text === 'myActivity') {
                        defaultExportFunctionName = functionExpression.name.text;
                        myActivityFunctionNode = functionExpression;
                    } else {
                        defaultExportFunctionName = 'myActivity';
                        myActivityFunctionNode = functionExpression;
                    }
                }
            }
            ts.forEachChild(node, findDefaultExportedFunction);
        }


        // Function to find other functions
        function findOtherFunctions(node: ts.Node) {
            if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
                const functionName = node.name.text;
                if (functionName !== 'myActivity') {
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
                                if (functionName !== 'myActivity') {
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
        if (defaultExportFunctionName !== 'myActivity') {
            throw new BadRequestException({
                message: 'Workflow code validation failed',
                errors: ['Default exported function must be named "myActivity".'],
            });
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
     * Validate the structure of the TypeScript activityCode.
     */
    private validateTypeScriptCodeStructure(activityCode: string): void {
        const sourceFile = ts.createSourceFile('activity.ts', activityCode, ts.ScriptTarget.ES2020, true);

        let validationResult = {
            hasDefaultExport: false,
            hasAsyncFunction: false,
            hasTwoParameters: false,
            hasReturnType: false,
        };

        const validateNode = (node: ts.Node) => {
            if (
                ts.isFunctionDeclaration(node) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
            ) {
                validationResult.hasDefaultExport = true;
                validationResult.hasAsyncFunction = node.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
                validationResult.hasTwoParameters = node.parameters?.length === 2;
                validationResult.hasReturnType = !!node.type;
            }

            ts.forEachChild(node, validateNode);
        };

        ts.forEachChild(sourceFile, validateNode);

        const validationErrors: string[] = [];

        if (!validationResult.hasDefaultExport) {
            validationErrors.push('Code must have a default export function');
        }
        if (!validationResult.hasAsyncFunction) {
            validationErrors.push('Default export must be an async function');
        }
        if (!validationResult.hasTwoParameters) {
            validationErrors.push('Function must accept exactly two parameters (input and config)');
        }
        if (!validationResult.hasReturnType) {
            validationErrors.push('Function should specify a return type');
        }

        if (validationErrors.length > 0) {
            this.logger.error('Activity code structure validation failed', JSON.stringify(validationErrors));
            throw new BadRequestException({
                message: `Activity code validation failed with error: ${validationErrors}`,
                errors: validationErrors,
            });
        }
    }

    // /**
    //  * Validate input and output schemas against the activityCode.
    //  */
    // private async validateTypeCompliance(
    //     activityCode: string,
    //     activityInputSchema: Record<string, any>,
    //     activityENVInputSchema: Record<string, any>,
    //     activityOutputSchema: Record<string, any>
    // ): Promise<void> {
    //     const sourceFile = ts.createSourceFile(
    //         'activity.ts',
    //         activityCode,
    //         ts.ScriptTarget.ES2020,
    //         true
    //     );

    //     // const combinedInputAndENVSchema = { ...activityInputSchema, ...activityENVInputSchema };

    //     // // Parse and validate schemas
    //     // this.logger.debug('Validating input schema compliance...');
    //     // this.validateSchemaKeys(sourceFile, activityInputSchema, 'activityInputSchema');

    //     // this.logger.debug('Validating output schema compliance...');
    //     // this.validateSchemaKeys(sourceFile, activityOutputSchema, 'activityInputVariables');

    //     this.logger.debug('Input and output schemas validated successfully.');
    // }

    // not implemented, placeholder
    // private validateSchemaKeys(
    //     sourceFile: ts.SourceFile,
    //     schema: Record<string, any>,
    //     schemaName: string
    // ): void {
    //     const schemaKeys = Object.keys(schema);

    //     // Inspect sourceFile for parameter or return type compliance
    //     schemaKeys.forEach((key) => {
    //         // Mock validation: Replace this with actual compliance logic
    //         if (!schema[key]) {
    //             this.logger.warn(`${schemaName} key "${key}" is missing or invalid.`);
    //         }
    //     });
    // }

    /**
     * Validate external imports are resolvable.
     */
    private async validateExternalImports(imports: string[]): Promise<void> {
        const missingModules: string[] = [];

        for (const moduleName of imports) {
            try {
                require.resolve(moduleName);
            } catch {
                missingModules.push(moduleName);
            }
        }

        if (missingModules.length > 0) {
            this.logger.error('Missing required modules', JSON.stringify(missingModules));
            throw new BadRequestException({
                message: 'One or more required modules are missing.',
                errors: missingModules.map((module) => `Module not found: ${module}`),
            });
        }

        this.logger.debug('All external imports validated successfully.');
    }

    /**
     * Test the activity with the provided activityRequest.
     */
    async testActivity(
        activity: {
            activityCode: string;
            activityInputSchema: Record<string, any>;
            activityENVInputSchema: Record<string, any>;
            activityOutputSchema: Record<string, any>;
            activityImports?: string[];
        },
        activityInputVariables: Record<string, any>,
        activityENVInputVariables: Record<string, any>
    ): Promise<OB1Activity.ActivityTestResponse> {
        this.logger.debug(`Testing activity... with input: \n${JSON.stringify(activityInputVariables, null, 2)} & ENV input: \n${JSON.stringify(activityENVInputVariables, null, 2)}`);
        const { activityCode, activityInputSchema, activityENVInputSchema, activityOutputSchema, activityImports } = activity;

        // Step 1: Validate activityRequest against activityInputSchema
        this.logger.debug('Validating activityRequest against activityInputSchema...');
        const validationPipe = new ValidationPipe({ whitelist: true, transform: true });

        try {
            // Transform and validate the activityInputVariables against the activity.activityInputSchema using the schema as a class
            const schemaClass = this.createSchemaClass(activityInputSchema);
            await validationPipe.transform(plainToClass(schemaClass, activityInputVariables), {
                type: 'body',
                metatype: schemaClass,
            });
        } catch (error) {
            this.logger.error('Validation of activityInputVariables failed', error.message);
            throw new BadRequestException({
                message: 'Validation of activityInputVariables failed',
                details: error.message,
            });
        }


        try {
            // Transform and validate the activityInputENVVariables against the activity.activityENVInputSchema using the schema as a class
            const ENVschemaClass = this.createSchemaClass(activityENVInputSchema);
            await validationPipe.transform(plainToClass(ENVschemaClass, activityENVInputVariables), {
                type: 'body',
                metatype: ENVschemaClass,
            });
        } catch (error) {
            this.logger.error('Validation of activityENVInputVariables failed', error.message);
            throw new BadRequestException({
                message: 'Validation of activityENVInputVariables failed',
                details: error.message,
            });
        }

        this.logger.debug(`Testing activity... with input: \n${JSON.stringify(activityInputVariables, null, 2)} & ENV input: \n${JSON.stringify(activityENVInputVariables, null, 2)}`);


        this.logger.debug('activityRequest validation passed.');

        // Step 2: Install external imports (if any)
        if (activityImports && activityImports.length > 0) {
            this.logger.debug('Installing required imports...');
            try {
                await this.installRequiredImports(activityImports);
            } catch (importError) {
                this.logger.error('Installation of required imports failed', importError.message);
                throw new BadRequestException({
                    message: 'Installation of required imports failed',
                    details: importError.message,
                });
            }
        }

        // Step 3: Execute activityCode
        let activityResponse;
        try {
            const input = {
                ...activityInputVariables,
            };

            const config = {
                activityENVInputVariables,
            };

            this.logger.debug(`Executing activityCode... with input: \n${JSON.stringify(input, null, 2)} & ENV input: \n${JSON.stringify(config, null, 2)}`);

            const createdActivity = this.compileActivityCode(activityCode);
            activityResponse = await createdActivity(
                input, config
            ); // Pass input and config
        } catch (executionError) {
            this.logger.error('Execution of activityCode failed', executionError.message);
            throw new BadRequestException({
                message: 'Execution of activityCode failed',
                details: executionError.message,
            });
        }

        this.logger.debug('Activity execution completed successfully.');

        // Step 4: Validate activityResponse against activityOutputSchema
        this.logger.debug('Validating activityResponse against activityOutputSchema...');
        const ajv = new Ajv({ allErrors: true });
        const validateOutput = ajv.compile(activityOutputSchema);

        const isValid = validateOutput(activityResponse);
        const validationErrors =
            validateOutput.errors?.map((err) => `${err.instancePath}: ${err.message}`) || [];

        const activityResponseValidationTestPass = isValid;

        const activityResponseValidationTestResult = {
            isValid,
            errors: validationErrors,
        };

        this.logger.debug('Activity testing completed.');

        // Step 5: Return the activityTestResponse
        return {
            activityResponse,
            activityResponseValidationTestResult,
            activityResponseValidationTestPass,
        };
    }


    /**
     * Dynamically create a class from a JSON schema for validation.
     */
    private createSchemaClass(schema: Record<string, any>): any {
        return class {
            constructor() {
                Object.keys(schema).forEach((key) => {
                    this[key] = schema[key].type; // Assign type based on schema
                });
            }
        };
    }

    /**
     * Compile TypeScript code and return the default export function.
     */
    private compileActivityCode(activityCode: string): (input: Record<string, any>, config: OB1Activity.ActivityStandardInputSchemaConfig) => Promise<OB1Activity.ActivityStandardOutputSchema> {
        const transpileResult = ts.transpileModule(activityCode, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
            },
        });

        if (transpileResult.diagnostics && transpileResult.diagnostics.length > 0) {
            const errors = transpileResult.diagnostics.map((diag) =>
                ts.flattenDiagnosticMessageText(diag.messageText, '\n')
            );
            throw new Error(`Activity code transpilation failed: ${errors.join(', ')}`);
        }

        const module = new Function('exports', 'require', 'module', '__filename', '__dirname', transpileResult.outputText);
        const exports: Record<string, any> = {};
        module(exports, require, { exports }, '', '');

        if (!exports.default || typeof exports.default !== 'function') {
            throw new Error('Activity code must export a default function.');
        }

        return exports.default as (input: Record<string, any>, config: OB1Activity.ActivityStandardInputSchemaConfig) => Promise<OB1Activity.ActivityStandardOutputSchema>;
    }

    /**
 * Install required modules for activity.
 */
    private async installRequiredImports(modules: string[]): Promise<void> {
        const moduleString = modules.join(' ');
        this.logger.debug(`Installing modules: ${moduleString}`);

        try {
            await execAsync(`npm install ${moduleString}`);
            this.logger.debug(`Modules installed successfully: ${moduleString}`);
        } catch (error) {
            this.logger.error(`Failed to install modules: ${moduleString}`, error.message);
            throw new Error(`Failed to install modules: ${moduleString}`);
        }
    }

}
