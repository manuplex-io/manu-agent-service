// src/llm/services/llm.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';


@Injectable()
export class LLMV3Service {

    private readonly logger = new Logger(LLMV3Service.name);

}