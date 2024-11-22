import { Global, Module } from '@nestjs/common';
import { PythonLambdaV1Service } from './services/toolSpecificService/pythonLambdaV1.service';
import { ToolTestingController } from './controllers/tool-testing.controller';
import { ToolsController } from './controllers/tools.controller';
import { ToolsManagementV1Service } from './services/toolsManagementV1.service';
import { ToolsExecutionV1Service } from './services/toolsExecutionV1.service';
@Global()
@Module({
    imports: [
    ],
    controllers: [
        ToolTestingController,
        ToolsController,
    ],
    providers: [
        PythonLambdaV1Service,
        ToolsManagementV1Service,
        ToolsExecutionV1Service,
    ],
    exports: [
        PythonLambdaV1Service,
        ToolsManagementV1Service,
        ToolsExecutionV1Service,
    ] // Export if you need to use it in other modules
})
export class ToolsModule { }