// src/prompts/services/promptV1.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentPromptExecutionLog } from '../../../prompts/entities/ob1-agent-promptExecutionLog.entity';


@Injectable()
export class PromptLogV1Service {
    private readonly logger = new Logger(PromptLogV1Service.name);

    constructor(
        @InjectRepository(OB1AgentPromptExecutionLog) private executionLogRepo: Repository<OB1AgentPromptExecutionLog>,
    ) { }

    async logExecution(logData: Partial<OB1AgentPromptExecutionLog>): Promise<void> {
        const log = this.executionLogRepo.create(logData);
        await this.executionLogRepo.save(log);
    }

    async getExecutionLogs(
        promptId: string,
        filters: {
            startDate?: Date;
            endDate?: Date;
            successful?: boolean;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ logs: OB1AgentPromptExecutionLog[]; total: number }> {
        const query = this.executionLogRepo.createQueryBuilder('log')
            .where('log.promptId = :promptId', { promptId });

        if (filters.startDate) {
            query.andWhere('log.executedAt >= :startDate', { startDate: filters.startDate });
        }

        if (filters.endDate) {
            query.andWhere('log.executedAt <= :endDate', { endDate: filters.endDate });
        }

        if (filters.successful !== undefined) {
            query.andWhere('log.successful = :successful', { successful: filters.successful });
        }

        const total = await query.getCount();

        query.orderBy('log.executedAt', 'DESC')
            .limit(filters.limit || 10)
            .offset(filters.offset || 0);

        const logs = await query.getMany();

        return { logs, total };
    }

    async sendToolLogToPortkey(logData: {
        request: {
            url?: string | 'url_unavailable'; // pseudo URL to identify the tool
            method?: string;  // defaults to 'POST'
            headers?: Record<string, string> | {};
            body: any;
        };
        response: {
            status?: number; //defaults to 200
            headers?: Record<string, string> | {};
            body: any;
            response_time: number;  //response latency
        };
        metadata: {
            traceId: string;
            spanId: string;
            spanName: string;
            parentSpanId?: string;
            additionalProperties?: string;
        };
    }): Promise<void> {
        //retrieve portkey from ENV (PORTKEY_API_KEY)
        const portkeyApiKey = process.env.PORTKEY_API_KEY;; // Replace with a secure fetch from config/env
        const url = 'https://api.portkey.ai/v1/logs';

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-portkey-api-key': portkeyApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData),
            });

            const jsonResponse = await res.json();
            this.logger.log('Tool log sent successfully to Portkey:', jsonResponse);
        } catch (err) {
            this.logger.error('Failed to send tool log to Portkey:', err);
        }
    }

}
