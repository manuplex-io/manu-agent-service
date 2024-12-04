// import axios from 'axios';
// import { PythonLambdaService } from '../../../tools/services/python-lambda.service';
// import { PromptServiceV1 } from '../../../prompts/services/promptV1.service';

// // export const invokeLambdaActivity = async (
// //     account_id: string,
// //     pythonLambdaService: PythonLambdaService
// // ): Promise<any> => {
// //     const toolId = 'b394c10a-a45c-409e-8679-1488bb20e55f';
// //     const lambdaInput = { account_id };

// //     try {
// //         // Invoke the lambda tool using the provided PythonLambdaService instance
// //         const lambdaResult = await pythonLambdaService.invokeLambda(toolId, lambdaInput);
// //         console.debug('Lambda Tool Result:', lambdaResult);

// //         if (lambdaResult && lambdaResult.statusCode === 200) {
// //             return lambdaResult.body; // Expected JSON data with the body included
// //         } else {
// //             throw new Error(`Lambda invocation failed with status ${lambdaResult.statusCode}`);
// //         }
// //     } catch (error) {
// //         console.error('Error in invokeLambdaActivity:', error);
// //         throw error;
// //     }
// // };

// export const invokeLambdaActivity = async (
//     input: any,
//     pythonLambdaService: PythonLambdaService
// ): Promise<any> => {
//     const { account_id } = input.account_id;
//     const toolId = input.toolId;
//     //const toolId = 'b394c10a-a45c-409e-8679-1488bb20e55f';
//     const lambdaInput = { account_id };

//     try {
//         // Invoke the lambda tool using the provided PythonLambdaService instance
//         const lambdaResult = await pythonLambdaService.invokeLambda(toolId, lambdaInput);
//         console.debug('Lambda Tool Result:', lambdaResult);

//         if (lambdaResult && lambdaResult.statusCode === 200) {
//             return lambdaResult.body; // Expected JSON data with the body included
//         } else {
//             throw new Error(`Lambda invocation failed with status ${lambdaResult.statusCode}`);
//         }
//     } catch (error) {
//         console.error('Error in invokeLambdaActivity:', error);
//         throw error;
//     }
// };

// export const executePromptStep2 = async (
//     userVariables: Record<string, any>,
//     promptService: PromptServiceV1
// ): Promise<any> => {
//     const promptIdStep2 = '67bc4779-acae-412a-bb61-f38ebdfa360c';

//     try {
//         const promptResultStep2 = await promptService.executewithoutUserPromptV1(
//             promptIdStep2,
//             userVariables,
//             {}  // systemVariables left empty if not required
//         );
//         console.debug('Prompt Result Step 2:', promptResultStep2);

//         if (promptResultStep2 && promptResultStep2.toolCalls[0].output.statusCode === 200) {
//             const toolCalls = promptResultStep2.toolCalls || [];
//             const opportunityId = toolCalls[0].arguments.opportunity_id;

//             // if (opportunityId) {
//             //     const systemVariablesStep3 = { opportunityId };
//             //     const userVariablesStep3 = {
//             //         //taskList: tasklist,
//             //         opportunityId,
//             //         //conversationSummary: conversation_summary
//             //     };
//             return opportunityId; // Expected prompt result in JSON format
//         } else {
//             throw new Error(`Prompt execution for Step 2 failed with status ${promptResultStep2.toolCalls[0].output.statusCode}`);
//         }
//     } catch (error) {
//         console.error('Error in executePromptStep2:', error);
//         throw error;
//     }
// };

// export const executePromptStep3 = async (
//     systemVariables: Record<string, any>,
//     userVariables: Record<string, any>,
//     promptService: PromptServiceV1
// ): Promise<any> => {
//     const promptIdStep3 = 'c808defb-5cd6-4ac2-ac79-35ea0b9cb0ce';
//     try {
//         const promptResultStep3 = await promptService.executewithoutUserPromptV1(
//             promptIdStep3,
//             userVariables,
//             systemVariables
//         );

//         if (promptResultStep3) {
//             return promptResultStep3; // Expected prompt result in JSON format
//         } else {
//             throw new Error(`Prompt execution for Step 3 failed with status ${promptResultStep3}`);
//         }
//     } catch (error) {
//         console.error('Error in executePromptStep3:', error);
//         throw error;
//     }
// };