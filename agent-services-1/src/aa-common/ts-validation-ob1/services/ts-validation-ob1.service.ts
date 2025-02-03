import { Injectable, OnModuleDestroy, Logger, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { ConfigService } from '@nestjs/config';
import Ajv from 'ajv';
import { OB1TSValidation } from '../interfaces/ts-validation-ob1.interface';
import * as path from 'path';
import { exec } from 'child_process';
import { OB1Workflow } from 'src/workflows/interfaces/workflow.interface';

@Injectable()
export class TSValidationOb1Service {
  private readonly logger = new Logger(TSValidationOb1Service.name);
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv();
  }

  //#region compilation
  public async compileTypeScriptCheckForWorkflowExecution(workflowSourceCode?: string, activitySourceCode?: string): Promise<void> {
    try {
      const tempDir = path.join(process.cwd(), 'temp-ts-compile');
      if (!fsSync.existsSync(tempDir)) {
        fsSync.mkdirSync(tempDir, { recursive: true });
      }

      const activityFilePath = path.join(tempDir, 'myActivity.ts');
      const workflowFilePath = path.join(tempDir, 'myWorkflow.ts');
      const tsConfigPath = path.join(tempDir, 'tsconfig.json');

      // workflow file doesn't always get created(ex: when creating activity)
      // activity file always gets created(even if empty)
      // Write the TypeScript files based on the provided source code
      if (workflowSourceCode) {
        await fs.writeFile(workflowFilePath, workflowSourceCode, 'utf8');
      }      
      await fs.writeFile(activityFilePath, activitySourceCode || 'export {};', 'utf8');
      
      // Create a more comprehensive tsconfig.json
      const tsConfig = {
        compilerOptions: {
          target: "es2022",
          module: "commonjs",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: workflowSourceCode ? ["myWorkflow.ts"] : ["myActivity.ts"],
        exclude: ["node_modules"]
      };
      await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf8');
      this.logger.log(`tsconfig.json created: ${tsConfigPath}`);
      // Compile the TypeScript files
      await this.compileTypeScript(tempDir);
      // Clean up temporary files
      // await fs.rm(tempDir, { recursive: true, force: true });

      return;
    } 
    catch (error) {
      this.logger.error(`Error during TypeScript compilation: ${error.message}`);
      throw new BadRequestException({
        message: 'TypeScript compilation failed',
        details: error.details || error.message
      });
    }
  }

  private async compileTypeScript(folderPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fsSync.existsSync(folderPath)) {
        throw new BadRequestException(`Folder ${folderPath} does not exist`);
      }

      this.logger.log(`Folder contents before compilation:`);
      const files = fsSync.readdirSync(folderPath);
      files.forEach(file => this.logger.log(`- ${file}`));
      exec(`npx tsc --project ${folderPath}`, (error, stdout, stderr) => {
        if (error) {
          const errorDetails = {
            message: 'TypeScript compilation failed',
            error: error.message,
            stderr: stderr,
            stdout: stdout,
            folderPath: folderPath,
            files: files
          };
          // fs.rm(folderPath, { recursive: true, force: true });
          this.logger.error('Compilation Error Details:', errorDetails);
          reject(new Error(JSON.stringify(errorDetails)));
        } else {
          this.logger.log(`TypeScript compilation successful: ${stdout}`);
          resolve();
        }
      });
    });
  }
  //#endregion

  //#region Validation
  // Validate input against input schema and return true if valid
  public validateInputAgainstInputSchema(inputSchema: any = {}, input: any = {}): boolean {
    const validate = this.ajv.compile(inputSchema);

    if (!validate(input)) {
      const errors = validate.errors?.map(error => ({
        field: error.instancePath,
        message: error.message,
      }));

      this.logger.error(`Input validation failed: ${JSON.stringify(errors, null, 2)}`);
      throw new BadRequestException({
        message: 'Input validation against input schema failed',
        errors: errors,
      });
    }
    return true;
  }

  // Validate input against input schema and return the arguments
  public validateInputAgainstInputSchemaReturnArgs(inputSchema: any = {}, input: any): any[] {
    const validate = this.ajv.compile(inputSchema);

    if (!validate(input)) {
      const errors = validate.errors?.map(error => ({
        field: error.instancePath,
        message: error.message,
      }));

      this.logger.error(`Input validation failed: ${JSON.stringify(errors, null, 2)}`);
      throw new BadRequestException({
        message: 'Input validation against input schema failed',
        errors: errors,
      });
    }
    return Object.keys(inputSchema.properties).map(key =>
      input[key]
    );
  }

  // Check if input array elements exist as keys in schema and required keys exist in input array
  public validateInputKeysExistInSchema(inputSchema: any = {}, inputArray: string[], checkSchema: string): boolean {
    const schemaProperties = Object.keys(inputSchema.properties || {});
    const requiredProperties = inputSchema.required || [];
    const errors = [];


    for (const required of requiredProperties) {
      if (!inputArray.includes(required)) {
        errors.push({
          field: required,
          message: `Required key "${required}" not found in input array`,
        });
      }
    }

    if (errors.length > 0) {
      this.logger.error(`Input key validation failed for ${checkSchema} : ${JSON.stringify(errors, null, 2)}`);
      throw new BadRequestException({
        message: `Input key validation failed for ${checkSchema}`,
        errors: errors,
      });
    }

    return true;
  }
  // #endregion

  // #region CRUD Stage
  // Update config input to optional if unused
  public updateConfigInputToOptionalIfUnused(sourceCode: string): string {
    // Create source file from the code
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    let configIsUsed = false;

    // Create visitor function to check for config usage
    function checkConfigUsage(node: ts.Node) {
      if (ts.isIdentifier(node) && node.text === 'config') {
        // Check if this identifier is not part of the parameter declaration
        if (node.parent && !ts.isParameter(node.parent)) {
          configIsUsed = true;
        }
      }
      ts.forEachChild(node, checkConfigUsage);
    }

    // Create transformer
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
      return (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
          if (ts.isFunctionDeclaration(node)) {
            // First check if config is used in the function body
            checkConfigUsage(node.body);

            // If config is not used, make it optional
            if (!configIsUsed) {
              const configParam = node.parameters.find(p =>
                ts.isIdentifier(p.name) && p.name.text === 'config'
              );

              if (configParam) {
                const updatedParams = node.parameters.map(param => {
                  if (ts.isIdentifier(param.name) && param.name.text === 'config') {
                    return ts.factory.updateParameterDeclaration(
                      param,
                      param.modifiers,
                      param.dotDotDotToken,
                      param.name,
                      ts.factory.createToken(ts.SyntaxKind.QuestionToken), // Add optional modifier
                      param.type,
                      param.initializer
                    );
                  }
                  return param;
                });

                return ts.factory.updateFunctionDeclaration(
                  node,
                  node.modifiers,
                  node.asteriskToken,
                  node.name,
                  node.typeParameters,
                  updatedParams,
                  node.type,
                  node.body
                );
              }
            }
          }
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
      };
    };

    // Apply transformation
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

    return transformedCode;
  }


  public extractEnvironmentVariables(sourceCode: string, sourceType: string): string[] {
    // Create source file from the code
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const activityENVInputVariables = new Set<string>();

    function visit(node: ts.Node) {
      // Check for direct access to config.<sourceType>ENVInputVariables
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.expression.text === 'config' &&
        node.expression.name.text === `${sourceType}ENVInputVariables`
      ) {
        if (ts.isIdentifier(node.name)) {
          activityENVInputVariables.add(node.name.text);
        }
      }

      // Check for destructuring of config.<sourceType>ENVInputVariables
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isPropertyAccessExpression(node.initializer) &&
        ts.isPropertyAccessExpression(node.initializer.expression) &&
        ts.isIdentifier(node.initializer.expression.expression) &&
        ts.isIdentifier(node.initializer.expression.name) &&
        node.initializer.expression.expression.text === 'config' &&
        node.initializer.expression.name.text === `${sourceType}ENVInputVariables`
      ) {
        if (ts.isIdentifier(node.name)) {
          activityENVInputVariables.add(node.name.text);
        }
      }

      // Check for object destructuring of config.<sourceType>ENVInputVariables
      if (
        ts.isBindingElement(node) &&
        node.parent &&
        ts.isObjectBindingPattern(node.parent) &&
        node.parent.parent &&
        ts.isVariableDeclaration(node.parent.parent) &&
        node.parent.parent.initializer &&
        ts.isPropertyAccessExpression(node.parent.parent.initializer) &&
        ts.isIdentifier(node.parent.parent.initializer.expression) &&
        node.parent.parent.initializer.expression.text === `config.${sourceType}ENVInputVariables`
      ) {
        if (ts.isIdentifier(node.name)) {
          activityENVInputVariables.add(node.name.text);
        }
      }

      ts.forEachChild(node, visit);
    }

    // Start the recursive visit
    visit(sourceFile);

    // Convert Set to Array and return
    return Array.from(activityENVInputVariables);
  }

  public removeExportDefaultModifiers(sourceCode: string): string {
    // Create source file from the code
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    function handleExportDefaultModifier(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
      const hasExportDefault = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword) &&
        node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);

      if (hasExportDefault) {
        const modifiers = node.modifiers.filter(
          mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
        );

        return ts.factory.updateFunctionDeclaration(
          node,
          modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );
      }
      return node;
    }

    // Create transformer
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
      return (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
          if (ts.isFunctionDeclaration(node)) {
            return handleExportDefaultModifier(node);
          }
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
      };
    };

    // Apply transformation
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

    return transformedCode;
  }
  //#endregion

  //#region Execution Stage
  // Replace function name with new function name
  public replaceFunctionNameAndDefaultForExecution(request: OB1TSValidation.FunctionNameReplacement): string {
    const { sourceCode, newFunctionName, functionType } = request;
    // Create source file from the code
    const sourceFile = ts.createSourceFile(
      OB1TSValidation.FileType[functionType.toUpperCase()],
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );


    function handleFunctionNameReplacement(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
      const defaultFunctionName = OB1TSValidation.FunctionName[functionType.toUpperCase()];

      if (node.name && node.name.text === defaultFunctionName) {
        return ts.factory.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          ts.factory.createIdentifier(newFunctionName),
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );
      }
      return node;
    }

    function handleExportDefaultModifier(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
      const hasExportDefault = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword) &&
        node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);

      if (hasExportDefault) {
        const modifiers = node.modifiers.filter(
          mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
        );

        return ts.factory.updateFunctionDeclaration(
          node,
          modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );
      }
      return node;
    }

    function findAndReplaceFunctionName(node: ts.Node): ts.Node {
      if (ts.isFunctionDeclaration(node)) {
        const nameReplacement = handleFunctionNameReplacement(node);
        const exportModification = handleExportDefaultModifier(nameReplacement);
        return exportModification;
      }
      return node;
    }

    // Create transformer
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
      return (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
          node = findAndReplaceFunctionName(node);
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
      };
    };

    // Apply transformation
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

    return transformedCode;
  }
  //#endregion

  public validateAndConsolidateWorkflowImports(sourceCode: string): string {
    const sourceFile = ts.createSourceFile('temp.ts', sourceCode, ts.ScriptTarget.Latest, true);
    const importMap: Record<string, Set<string>> = {};
    // Use Map instead of Set to ensure uniqueness by module specifier
    const typeImports: Map<string, ts.ImportDeclaration> = new Map();

    function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

            // Handle type imports and namespace imports separately
            if (
                node.importClause?.isTypeOnly || 
                (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings))
            ) {
                typeImports.set(moduleSpecifier, node);
                return;
            }

            // Handle regular named imports
            if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                if (!importMap[moduleSpecifier]) {
                    importMap[moduleSpecifier] = new Set();
                }

                node.importClause.namedBindings.elements.forEach(element => {
                    importMap[moduleSpecifier].add(element.name.text);
                });
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    // Create consolidated named imports
    const newImportStatements = Object.entries(importMap)
        .sort(([moduleA], [moduleB]) => moduleA.localeCompare(moduleB))
        .map(([module, imports]) => {
            const sortedImports = Array.from(imports).sort();
            const importSpecifiers = sortedImports.map(importName =>
                ts.factory.createImportSpecifier(
                    false,
                    undefined,
                    ts.factory.createIdentifier(importName)
                )
            );

            const namedImports = ts.factory.createNamedImports(importSpecifiers);
            const importClause = ts.factory.createImportClause(false, undefined, namedImports);
            const moduleSpecifier = ts.factory.createStringLiteral(module);

            return ts.factory.createImportDeclaration(
                undefined,
                importClause,
                moduleSpecifier
            );
        });

    // Combine type/namespace imports with named imports
    const updatedStatements = [
        ...Array.from(typeImports.values()),
        ...newImportStatements,
        ...sourceFile.statements.filter(statement => !ts.isImportDeclaration(statement))
    ];

    const updatedSourceFile = ts.factory.updateSourceFile(sourceFile, updatedStatements);
    return printer.printFile(updatedSourceFile);
  }

  // Giving empty array for activityExternalNames will ONLY remove all proxyActivities declarations
  // Giving non-empty array for activityExternalNames will remove all proxyActivities declarations and add the new consolidated activityExternalNames
  public validateAndConsolidateActivityImports(updatedWorkflowCode: string, activityExternalNames: string[]): string {
    const sourceFile = ts.createSourceFile('temp.ts', updatedWorkflowCode, ts.ScriptTarget.Latest, true);
    let hasProxyActivities = false;

    // Create transformer
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
        return (rootNode: T) => {
            function visit(node: ts.Node): ts.Node {
                // Remove existing proxyActivities declarations
                if (ts.isVariableStatement(node)) {
                    const declaration = node.declarationList.declarations[0];
                    if (declaration && 
                        ts.isVariableDeclaration(declaration) && 
                        declaration.initializer &&
                        ts.isCallExpression(declaration.initializer) &&
                        ts.isIdentifier(declaration.initializer.expression) &&
                        declaration.initializer.expression.text === 'proxyActivities') {
                        hasProxyActivities = true;
                        return undefined!;
                    }
                }
                return ts.visitEachChild(node, visit, context);
            }
            return ts.visitNode(rootNode, visit);
        };
    };

    // Apply transformation
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    let transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

    // Add consolidated proxyActivities statement if any were found
    if (hasProxyActivities && activityExternalNames.length > 0) {
        const proxyStatement = `const { ${activityExternalNames.join(', ')} } = proxyActivities<typeof activities>({ startToCloseTimeout: '1 minute' });\n\n`;
        transformedCode = proxyStatement + transformedCode;
    }

    return transformedCode;
  }

  public replaceWorkflowFunctionName(sourceCode: string, newFunctionName: string): string {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
    // Create transformer
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
      return (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
          if (ts.isFunctionDeclaration(node) && node.name?.text === 'myWorkflow') {
            // Filter out default modifier if it exists
            const modifiers = node.modifiers?.filter(
              mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
            );

            return ts.factory.updateFunctionDeclaration(
              node,
              modifiers, // Use filtered modifiers
              node.asteriskToken,
              ts.factory.createIdentifier(newFunctionName),
              node.typeParameters,
              node.parameters,
              node.type,
              node.body
            );
          }
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
      };
    };
    // Apply transformation
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(result.transformed[0] as ts.SourceFile);
  }
}


// #region DEPRECATED
  // public replaceWorkflowFunctionName(sourceCode: string, newFunctionName: string): string {
  //   const sourceFile = ts.createSourceFile(
  //     'temp.ts',
  //     sourceCode,
  //     ts.ScriptTarget.Latest,
  //     true
  //   );

  //   // Create transformer
  //   const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
  //     return (rootNode: T) => {
  //       if (!ts.isSourceFile(rootNode)) {
  //         return rootNode;
  //       }

  //       // Filter out import declarations and transform remaining statements
  //       const statements = rootNode.statements.filter(
  //         statement => !ts.isImportDeclaration(statement)
  //       ).map(statement => {
  //         if (ts.isFunctionDeclaration(statement)) {
  //           // Get existing modifiers without 'default'
  //           const modifiers = statement.modifiers?.filter(
  //             mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
  //           ) || [];

  //           // Ensure there's an export modifier
  //           if (!modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
  //             modifiers.push(ts.factory.createToken(ts.SyntaxKind.ExportKeyword));
  //           }

  //           // Create new function name if it's 'myWorkflow'
  //           const newName = statement.name && 
  //             statement.name.text === 'myWorkflow' ? 
  //             ts.factory.createIdentifier('childWorkflow') : 
  //             statement.name;

  //           return ts.factory.updateFunctionDeclaration(
  //             statement,
  //             modifiers,
  //             statement.asteriskToken,
  //             newName,
  //             statement.typeParameters,
  //             statement.parameters,
  //             statement.type,
  //             statement.body
  //           );
  //         }
  //         return statement;
  //       });

  //       // Create namespace wrapping all transformed statements
  //       const namespaceDeclaration = ts.factory.createModuleDeclaration(
  //         [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
  //         ts.factory.createIdentifier(newFunctionName),
  //         ts.factory.createModuleBlock(statements),
  //         ts.NodeFlags.Namespace
  //       );

  //       // Return source file with just the namespace
  //       return ts.factory.updateSourceFile(
  //         rootNode,
  //         [namespaceDeclaration]
  //       );
  //     };
  //   };

  //   // Apply transformation
  //   const result = ts.transform(sourceFile, [transformer]);
  //   const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  //   return printer.printFile(result.transformed[0] as ts.SourceFile);
  // }

// #endregion