// src/workflows/interceptors/validation.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    BadRequestException
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class ValidationInterceptor implements NestInterceptor {
    constructor(private readonly dtoClass: any) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();
        const body = request.body;

        // Transform body to DTO instance
        const dtoObject = plainToInstance(this.dtoClass, body);

        // Validate
        const errors = await validate(dtoObject, { whitelist: true });

        if (errors.length > 0) {
            throw new BadRequestException({
                message: 'Validation failed',
                errors: errors.map(error => ({
                    property: error.property,
                    constraints: error.constraints
                }))
            });
        }

        // Replace request.body with validated object
        request.body = dtoObject;
        return next.handle();
    }
}