// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
//import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { validate } from 'class-validator';
import { PORTKEY_GATEWAY_URL, createHeaders } from 'portkey-ai'
//import { OB1LLM } from '../interfaces/llmV2.interfaces';



@Injectable()
export class OpenAIV1Service {

    private readonly logger = new Logger(OpenAIV1Service.name);
    private readonly openai: OpenAI;
    private validationPipe = new ValidationPipe({ transform: true, whitelist: true }); // Instantiates ValidationPipe
    constructor(
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: PORTKEY_GATEWAY_URL,
            defaultHeaders: createHeaders({
                provider: "openai",
                apiKey: process.env.PORTKEY_API_KEY // uses environment variable for Portkey API key
            })
        });
    }







}