import { Global, Module } from '@nestjs/common';
import { PythonLambdaV1Service } from './services/toolSpecificService/pythonLambdaV1.service';
import { ToolsManagementV1Service } from './services/toolsManagementV1.service';
import { ToolsExecutionV1Service } from './services/toolsExecutionV1.service';
import { ToolsCatogoryManagementV1Service } from './services/toolsCatogoryManagementV1.service';

@Global()
@Module({
    imports: [
    ],
    controllers: [],
    providers: [

        ToolsManagementV1Service,
        ToolsExecutionV1Service,
        ToolsCatogoryManagementV1Service,

        PythonLambdaV1Service,
    ],
    exports: [

        ToolsManagementV1Service,
        ToolsExecutionV1Service,
        ToolsCatogoryManagementV1Service,

        PythonLambdaV1Service,
    ] // Export if you need to use it in other modules
})
export class ToolsModule { }