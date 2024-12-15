// /src/activity/services/activityLoadingV1.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// import * as ts from 'typescript';

import { OB1AgentActivities } from '../entities/ob1-agent-activities.entity';
import { RedisOb1Service } from '../../aa-common/redis-ob1/services/redis-ob1.service';

import { OB1Activity } from '../interfaces/activity.interface';
import { TSValidationOb1Service } from '../../aa-common/ts-validation-ob1/services/ts-validation-ob1.service';
import { OB1TSValidation } from '../../aa-common/ts-validation-ob1/interfaces/ts-validation-ob1.interface';

@Injectable()
export class ActivityLoadingV1Service {
    private readonly logger = new Logger(ActivityLoadingV1Service.name);
    private readonly REDIS_WORKFLOW_BASE_KEY = 'agentService:workerService:workflows';

    constructor(
        @InjectRepository(OB1AgentActivities) private readonly activityRepository: Repository<OB1AgentActivities>,
        private readonly redisService: RedisOb1Service,
        private readonly tsValidationOb1Service: TSValidationOb1Service,
    ) { }
    // Load Any Redis
    // NOTE: We haven't decided what to return from this function.
    async loadAnyActivityToRedis(activityInput: OB1Activity.ActivityLoadingRequest): Promise<void> {
        try {
            const { activityCode, imports, workflowExternalName } = activityInput;
            let isTTLUpdated = false;
            const redisActivityKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${workflowExternalName}:activityCode`;
            const redisImportKey = `${this.REDIS_WORKFLOW_BASE_KEY}:${workflowExternalName}:imports`;

            const redisExistingActivityCode = await this.redisService.get(redisActivityKey);
            const redisExistingImports = await this.redisService.getSet(redisImportKey);

            
            if(redisExistingActivityCode && redisExistingImports){
                const ttlUpdateResult = await this.redisService.updateTTL([redisActivityKey, redisImportKey]);
                if(ttlUpdateResult){
                    isTTLUpdated = true;
                }
            }
            // return only if all ttl are updated, pulled out return statement for now.
            if(isTTLUpdated)
                return;

            // More error handling needed
            const activityResult = await this.redisService.set(redisActivityKey, activityCode);
            const importResult = await this.redisService.set(redisImportKey, imports);

            return;
        } catch (error) {
            this.logger.log(`Failed to load activity:\n${JSON.stringify(error, null, 2)}`);
            throw new BadRequestException({
                message: 'Failed to load activity',
                errorSuperDetails: { ...error },
            });
        }
    }
}



// #region  DEPRECATED
// moved to ts-validation-ob1.service.ts for general purpose
// private replaceActivityFunctionName(sourceCode: string, newFunctionName: string): string {
//     // Create source file from the activity code
//     const sourceFile = ts.createSourceFile(
//         'activity.ts',
//         sourceCode,
//         ts.ScriptTarget.Latest,
//         true
//     );

//     function handleFunctionNameReplacement(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
//         if (node.name && node.name.text === 'myActivity') {
//             return ts.factory.updateFunctionDeclaration(
//                 node,
//                 node.modifiers,
//                 node.asteriskToken,
//                 ts.factory.createIdentifier(newFunctionName),
//                 node.typeParameters,
//                 node.parameters,
//                 node.type,
//                 node.body
//             );
//         }
//         return node;
//     }

//     function handleExportDefaultModifier(node: ts.FunctionDeclaration): ts.FunctionDeclaration | undefined {
//         const hasExportDefault = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword) &&
//                                 node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
        
//         if (hasExportDefault) {
//             const modifiers = node.modifiers.filter(
//                 mod => mod.kind !== ts.SyntaxKind.DefaultKeyword
//             );

//             return ts.factory.updateFunctionDeclaration(
//                 node,
//                 modifiers,
//                 node.asteriskToken,
//                 node.name,
//                 node.typeParameters,
//                 node.parameters,
//                 node.type,
//                 node.body
//             );
//         }
//         return node;
//     }

//     function findAndReplaceFunctionName(node: ts.Node): ts.Node {
//         if (ts.isFunctionDeclaration(node)) {
//             const nameReplacement = handleFunctionNameReplacement(node);
//             const exportModification = handleExportDefaultModifier(nameReplacement);
//             return exportModification;
//         }
//         return node;
//     }

//     // Create transformer
//     const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
//         return (rootNode: T) => {
//             function visit(node: ts.Node): ts.Node {
//                 node = findAndReplaceFunctionName(node);
//                 return ts.visitEachChild(node, visit, context);
//             }
//             return ts.visitNode(rootNode, visit);
//         };
//     };

//     // Apply transformation
//     const result = ts.transform(sourceFile, [transformer]);
//     const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
//     const transformedCode = printer.printFile(result.transformed[0] as ts.SourceFile);

//     return transformedCode;
// }

// #endregion