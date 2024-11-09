import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PythonLambdaService } from '../../tools/services/python-lambda.service';
import { PromptService } from '../../prompts/services/prompt.service';

@Controller('workflows')
export class WorkflowsController {
    private readonly logger = new Logger(WorkflowsController.name);

    constructor(
        private readonly pythonLambdaService: PythonLambdaService,
        private readonly promptService: PromptService
    ) { }

    @Post()
    async handleWorkflow(
        @Body() input: {
            account_id: string;
            contact_name: string;
            contact_id: string;
            conversation_summary: string;
            tasklist: string;
        }
    ): Promise<any> {
        const { account_id, contact_name, contact_id, conversation_summary, tasklist } = input;

        try {
            // Step 1: Invoke Lambda tool "Salesforce_Account_Opportunities_Retriever"
            const toolId = 'b394c10a-a45c-409e-8679-1488bb20e55f';
            const lambdaInput = { account_id };
            const lambdaResult = await this.pythonLambdaService.invokeLambda(toolId, lambdaInput);
            this.logger.debug('Lambda Tool Result:', lambdaResult);

            if (lambdaResult.body && lambdaResult.statusCode === 200) {

                const opportunityDetails = lambdaResult.body;

                const userVariablesStep2 = {
                    account_id,
                    contact_name,
                    contact_id,
                    opportunity_details: opportunityDetails,
                    conversation_summary
                };

                // Step 2: Execute Prompt 'Add Meeting Event for Salesforce Opportunities'
                const promptIdStep2 = '67bc4779-acae-412a-bb61-f38ebdfa360c';
                const promptResultStep2 = await this.promptService.executewithoutUserPrompt(
                    promptIdStep2,
                    userVariablesStep2,
                    {}  // systemVariables left empty if not required
                );
                this.logger.debug('Prompt Result Step 2:', promptResultStep2);

                if (promptResultStep2 && promptResultStep2.toolCalls[0].output.statusCode === 200) {
                    const toolCalls = promptResultStep2.toolCalls || [];
                    const opportunityId = toolCalls[0].arguments.opportunity_id;

                    if (opportunityId) {
                        const systemVariablesStep3 = { opportunityId };
                        const userVariablesStep3 = {
                            taskList: tasklist,
                            opportunityId,
                            conversationSummary: conversation_summary
                        };

                        // Step 3: Execute second prompt ""Create Tasks for Salesforce Opportunity""
                        const promptIdStep3 = 'c808defb-5cd6-4ac2-ac79-35ea0b9cb0ce';
                        const promptResultStep3 = await this.promptService.executewithoutUserPrompt(
                            promptIdStep3,
                            userVariablesStep3,
                            systemVariablesStep3
                        );
                        this.logger.debug('Prompt Result Step 3:', promptResultStep3);

                        return { promptResultStep3 };
                    } else {
                        this.logger.error('Could not retrieve opportunityId from Step 2 result');
                        throw new HttpException('Failed at Step 2: Could not retrieve opportunityId', HttpStatus.INTERNAL_SERVER_ERROR);
                    }
                } else {
                    this.logger.error('Step 2: Prompt execution failed', promptResultStep2);
                    throw new HttpException('Failed at Step 2: Prompt execution failed', HttpStatus.INTERNAL_SERVER_ERROR);
                }
            } else {
                this.logger.error('Step 1: Lambda invocation failed', lambdaResult);
                throw new HttpException('Failed at Step 1: Lambda invocation failed', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        } catch (error) {
            this.logger.error('Error executing workflow:', error);
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
