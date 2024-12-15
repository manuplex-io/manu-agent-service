import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from 'class-validator';
  
import { Logger } from '@nestjs/common';

const logger = new Logger('FileSizeValidator');

export function IsBase64FileSize(maxSizeInBytes: number, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
    registerDecorator({
        name: 'isBase64FileSize',
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [maxSizeInBytes],
        validator: {
        validate(value: any, args: ValidationArguments) {
            if (typeof value !== 'string') return false;

            // Skip validation if it's a URL
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return true;
            }
            
            // Remove padding characters
            const base64Str = value.split(',')[1] || value; // Handle potential data URI format
            const padding = (base64Str.match(/=/g) || []).length;
            const fileSizeInBytes = (base64Str.length * 3) / 4 - padding;
            return fileSizeInBytes <= args.constraints[0];
        },
        defaultMessage(args: ValidationArguments) {
            const maxSize = args.constraints[0];
            return `File size exceeds the maximum limit of ${maxSize} bytes.`;
        },
        },
    });
    };
}
