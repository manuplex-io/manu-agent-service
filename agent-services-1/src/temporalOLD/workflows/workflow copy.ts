// // workflow.ts
// import { invokeLambdaActivity, executePromptStep2, executePromptStep3 } from '../activities/activities';
// import { PythonLambdaService } from '../../../tools/services/python-lambda.service';

// const pythonLambdaService = new PythonLambdaService(toolV1);

// export const workflow = async (
//     account_id: string,
//     contact_name: string,
//     contact_id: string,
//     conversation_summary: string,
//     tasklist: string
// ) => {
//     try {
//         // Step 1: Invoke Lambda
//         const lambdaResult = await invokeLambdaActivityV1(account_id);
//         const opportunityDetails = lambdaResult.body;

//         // Step 2: Execute Prompt for Step 2
//         const userVariablesStep2 = {
//             account_id,
//             contact_name,
//             contact_id,
//             opportunity_details: opportunityDetails,
//             conversation_summary
//         };
//         const promptResultStep2 = await executePromptStep2(userVariablesStep2);

//         if (promptResultStep2.statusCode !== 200) {
//             throw new Error('Prompt execution for Step 2 failed');
//         }

//         const opportunityId = promptResultStep2.toolCalls[0]?.arguments.opportunity_id;
//         if (!opportunityId) {
//             throw new Error('Failed to retrieve opportunityId from Step 2 result');
//         }

//         // Step 3: Execute Prompt for Step 3
//         const systemVariablesStep3 = { opportunityId };
//         const userVariablesStep3 = {
//             taskList: tasklist,
//             opportunityId,
//             conversationSummary: conversation_summary
//         };
//         const promptResultStep3 = await executePromptStep3(systemVariablesStep3, userVariablesStep3);

//         return promptResultStep3; // Final result
//     } catch (error) {
//         console.error('Workflow error:', error);
//         throw error;
//     }
// };