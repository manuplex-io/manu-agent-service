// src/workflows/exceptions/activity.exceptions.ts
export class ActivityExecutionError extends Error {
    constructor(
        public readonly message: string,
        public readonly details?: any,
        public readonly logs?: string[]
    ) {
        super(message);
        this.name = 'ActivityExecutionError';
    }
}

export class ActivityInputValidationError extends Error {
    constructor(
        public readonly message: string,
        public readonly validationErrors: any[]
    ) {
        super(message);
        this.name = 'ActivityInputValidationError';
    }
}