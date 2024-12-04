// src/workflows/interceptors/logging.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('ActivityAPI');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        const now = Date.now();

        return next.handle().pipe(
            tap({
                next: (data: any) => {
                    const response = context.switchToHttp().getResponse();
                    this.logger.log(
                        `${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`
                    );
                },
                error: (error: any) => {
                    this.logger.error(
                        `${method} ${url} - ${error.message} - ${Date.now() - now}ms`
                    );
                }
            })
        );
    }
}