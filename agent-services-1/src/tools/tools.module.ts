import { Global, Module } from '@nestjs/common';
import { PythonLambdaService } from './services/python-lambda.service';
import { ToolTestingController } from './controllers/tool-testing.controller';
import { ToolsController } from './controllers/tools.controller';
import { ToolsManagementService } from './services/tools-management.service';

@Global()
@Module({
    imports: [
    ],
    controllers: [
        ToolTestingController,
        ToolsController,
    ],
    providers: [
        PythonLambdaService,
        ToolsManagementService,
    ],
    exports: [
        PythonLambdaService,
        ToolsManagementService,
    ] // Export if you need to use it in other modules
})
export class ToolsModule { }