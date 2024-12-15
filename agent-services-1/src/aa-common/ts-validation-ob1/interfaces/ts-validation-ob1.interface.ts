export namespace OB1TSValidation {

  export enum FileType {
    WORKFLOW = 'workflow.ts',
    ACTIVITY = 'activity.ts',
  }

  export enum FunctionType {
    WORKFLOW = 'workflow',
    ACTIVITY = 'activity',
  }

  export enum FunctionName {
    WORKFLOW = 'myWorkflow',
    ACTIVITY = 'myActivity',
  }


  export interface FunctionNameReplacement {
    sourceCode: string;
    newFunctionName: string;
    functionType: OB1TSValidation.FunctionType;
  }
}
