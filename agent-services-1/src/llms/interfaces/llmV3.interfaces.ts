export namespace OB1LLMV3 {
    export enum LLMProvider {
        ANTHROPIC = 'anthropic',
        OPENAI = 'openai'
    }

    export interface ServiceResponse<T> {
        success: boolean;
        data?: T;
        error?: {
            code: string;
            message: string;
            details?: any;
        };
    }
}
