import { Injectable, OnModuleDestroy, Logger, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';

import { ConfigService } from '@nestjs/config';
import Ajv from 'ajv';
import { OB1TSValidation } from '../interfaces/ts-validation-ob1.interface';

@Injectable()
export class TSValidationOb1Service {
  private readonly logger = new Logger(TSValidationOb1Service.name);
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv();
  }

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

    for (const input of inputArray) {
      if (!schemaProperties.includes(input)) {
        errors.push({
          field: input,
          message: `Key "${input}" not found in ${checkSchema} schema properties`,
        });
      }
    }

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

    const envVariables = new Set<string>();

    function visit(node: ts.Node) {
      // Check for config.ENVVariables access
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        ts.isIdentifier(node.expression.expression.name) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.expression.expression.text === 'config' &&
        node.expression.expression.name.text === `${sourceType}ENVInputVariables`
      ) {
        if (ts.isIdentifier(node.name)) {
          envVariables.add(node.name.text);
        }
      }

      ts.forEachChild(node, visit);
    }

    // Start the recursive visit
    visit(sourceFile);

    // Convert Set to Array and return
    return Array.from(envVariables);
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
}