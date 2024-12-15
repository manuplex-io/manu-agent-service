// /src/tools/interfaces/Lambda.interface.ts
import { OB1AgentTools } from '../entities/ob1-agent-tools.entity';

export namespace OB1Lambda {

    export namespace Python {

        export class ToolRequestV1 {
            tool: OB1AgentTools;
            toolInputVariables?: Record<string, any>;
            requestingServiceId: string;
            toolENVInputVariables?: Record<string, any>; // New optional field for environment variables
        }

        export class ToolResponseV1 {
            toolResult: any;
            toolSuccess: boolean;
            toolExecutionTime: number;
            toolError?: {
                message: string;
                type?: string;
                stackTrace?: string;
            };
            toolstatusCodeReturned?: number;
        }
    }
}