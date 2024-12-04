

// src/workflows/interceptors/transform.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map(data => {
                if (data && typeof data === 'object') {
                    return {
                        statusCode: context.switchToHttp().getResponse().statusCode,
                        timestamp: new Date().toISOString(),
                        path: context.switchToHttp().getRequest().url,
                        data
                    };
                }
                return data;
            })
        );
    }
}