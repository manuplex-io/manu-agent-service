// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LLMV2Service } from 'src/llms/services/llmV2.service';
import { OB1LLM } from 'src/llms/interfaces/llmV2.interfaces';
import { OB1Prompt } from '../../interfaces/prompt.interface';


const DEFAULT_THRESHOLD = 70;

@Injectable()
export class PromptExecutionValidationV1Service {
    private readonly logger = new Logger(PromptExecutionValidationV1Service.name);

    constructor(
        private readonly llmV2Service: LLMV2Service,
    ) { }

    async validateResponse(request: OB1Prompt.ValidationRequest): Promise<OB1Prompt.ValidationScore> {
        const validationRequest: OB1LLM.LLMRequest = {
            systemPrompt: `You are a validation assistant focused on ensuring responses meet user needs and expectations. Analyze the conversation flow and results to determine if the response should be sent to the user.

            Evaluate these key aspects:

            1. RESPONSE RELEVANCE & COMPLETENESS (0-100):
            Evaluate how well the response addresses the user's actual needs:
            - Direct Answer: Does it clearly address the core question/request?
            - Completeness: Are all parts of the request addressed?
            - Context Retention: Did we maintain relevant context throughout?
            - Gap Analysis: Are there unanswered aspects or assumptions?

            2. TOOL USAGE EFFECTIVENESS (0-100):
            Analyze how tool calls contributed to the final response:
            - Necessity: Was each tool call required and relevant?
            - Result Integration: Were tool results properly interpreted and incorporated?
            - Sequence Logic: Did the tool usage follow a logical progression?
            - Value Added: Did each tool call meaningfully contribute to the answer?

            3. CLARITY & USABILITY (0-100):
            Assess how understandable and actionable the response is:
            - Language: Clear, appropriate level of technical detail
            - Structure: Well-organized, logical flow of information
            - Actionability: User can act on the information provided
            - Completeness: No critical information gaps

            4. ACCURACY & RELIABILITY (0-100):
            Verify the trustworthiness of the response:
            - Fact Checking: Information aligns with tool results
            - Consistency: No contradictions in the response
            - Source Quality: Reliable information sources used
            - Verification: Critical information is validated

            For each category:
            90-100: Exceptional - Ready for user consumption
            80-89: Strong - Minor improvements possible but ready
            70-79: Acceptable - Could benefit from improvements
            60-69: Needs Review - Notable issues to address
            0-59: Not Ready - Major issues prevent user delivery

            Provide specific feedback for each category:
            - What worked well
            - What could be improved
            - Any red flags or concerns
            - Suggestions for improvement

            Final score is weighted for user-centric priorities:
            - Response Relevance & Completeness: 35%
            - Tool Usage Effectiveness: 20%
            - Clarity & Usability: 25%
            - Accuracy & Reliability: 20%

            Also identify any critical issues that would prevent sending to user:
            - Missing critical information
            - Incorrect conclusions
            - Misleading information
            - Incomplete processes
            - Logical inconsistencies`,
            userPrompt: JSON.stringify({
                originalRequest: request.originalPrompts,
                toolCallHistory: request.toolCallHistory,
                finalResponse: request.finalResponse
            }),
            response_format: { 
                type: "json_schema",
                json_schema: {
                    name: 'validation_score',
                    schema: {
                        type: "object",
                        properties: {
                            metrics: {
                            type: "object",
                            properties: {
                                relevanceScore: { type: "number" },
                                toolUsageScore: { type: "number" },
                                clarityScore: { type: "number" },
                                accuracyScore: { type: "number" }
                            },
                            required: ['relevanceScore', 'toolUsageScore', 
                                     'clarityScore', 'accuracyScore']
                        },
                        analysis: {
                            type: "object",
                            properties: {
                                relevanceAnalysis: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "array", items: { type: "string" } },
                                        weaknesses: { type: "array", items: { type: "string" } },
                                        userImpact: { type: "string" }
                                    }
                                },
                                toolUsageAnalysis: {
                                    type: "object",
                                    properties: {
                                        toolEffectiveness: { type: "array", items: { type: "string" } },
                                        unnecessaryTools: { type: "array", items: { type: "string" } },
                                        missingTools: { type: "array", items: { type: "string" } }
                                    }
                                },
                                clarityAnalysis: {
                                    type: "object",
                                    properties: {
                                        readabilityIssues: { type: "array", items: { type: "string" } },
                                        structureIssues: { type: "array", items: { type: "string" } },
                                        improvementSuggestions: { type: "array", items: { type: "string" } }
                                    }
                                },
                                accuracyAnalysis: {
                                    type: "object",
                                    properties: {
                                        verifiedFacts: { type: "array", items: { type: "string" } },
                                        uncertainClaims: { type: "array", items: { type: "string" } },
                                        contradictions: { type: "array", items: { type: "string" } }
                                    }
                                }
                            },
                            required: ['relevanceAnalysis', 'toolUsageAnalysis', 
                                     'clarityAnalysis', 'accuracyAnalysis']
                        },
                        criticalIssues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    issue: { type: "string" },
                                    impact: { type: "string" },
                                    recommendation: { type: "string" }
                                }
                            }
                        }
                        },
                        required: ['metrics', 'analysis', 'criticalIssues'],
                        additionalProperties: false
                    }
                }
            },
            config: {
                provider: OB1LLM.LLMProvider.OPENAI,
                model: OB1LLM.OpenAIModels.GPT_4O,
                temperature: 0.1
            },
            tracing: request.tracing,
            requestMetadata: request.requestMetadata
        };

        const validationResponse = await this.llmV2Service
            .generateResponseWithStructuredOutputNoTools(validationRequest);
        
        const scores = validationResponse.content as OB1Prompt.ValidationScore;

        // Calculate weighted overall score
        const weights = {
            relevance: 0.35,
            toolUsage: 0.15,
            clarity: 0.25,
            accuracy: 0.25
        };

        scores.overallScore = (
            scores.metrics.relevanceScore * weights.relevance +
            scores.metrics.toolUsageScore * weights.toolUsage +
            scores.metrics.clarityScore * weights.clarity +
            scores.metrics.accuracyScore * weights.accuracy
        );

        // Determine pass/fail based on:
        // 1. Meeting minimum threshold
        // 2. No critical issues
        // 3. Minimum scores in critical categories (relevance and accuracy)
        const threshold = request.validationConfig?.threshold ?? DEFAULT_THRESHOLD;
        const hasCriticalIssues = scores.criticalIssues?.length > 0;
        // const meetsMinimumCriticalScores = 
        //     scores.metrics.relevanceScore >= 70 && 
        //     scores.metrics.accuracyScore >= 70;
        
        scores.passed = scores.overallScore >= threshold && !hasCriticalIssues;

        return scores;
    }


}