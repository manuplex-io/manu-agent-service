// // src/workflows/interceptors/base.interceptor.ts
// import {
//     Injectable,
//     NestInterceptor,
//     ExecutionContext,
//     CallHandler,
//     BadRequestException
// } from '@nestjs/common';
// import { validateSync } from 'class-validator';
// import { plainToInstance } from 'class-transformer';

// @Injectable()
// export abstract class BaseInterceptor implements NestInterceptor {
//     protected readonly logger = new Logger(this.constructor.name);
//     protected abstract readonly requestDtoClass?: any;
//     protected abstract readonly responseDtoClass?: any;

//     protected validateData(data: any, dtoClass: any): any {
//         if (!dtoClass) return data;

//         const dtoObject = plainToInstance(dtoClass, data);
//         const errors = validateSync(dtoObject, {
//             whitelist: true,
//             forbidNonWhitelisted: true
//         });

//         if (errors.length > 0) {
//             throw new BadRequestException({
//                 message: 'Validation failed',
//                 errors: errors.map(error => ({
//                     property: error.property,
//                     constraints: error.constraints
//                 }))
//             });
//         }

//         return dtoObject;
//     }

//     protected transformRequest(request: any): any {
//         if (this.requestDtoClass && request.body) {
//             request.body = this.validateData(request.body, this.requestDtoClass);
//         }
//         return request;
//     }

//     protected transformResponse(response: any): any {
//         if (this.responseDtoClass) {
//             return this.validateData(response, this.responseDtoClass);
//         }
//         return response;
//     }
// }