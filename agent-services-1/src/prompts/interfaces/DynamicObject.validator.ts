import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { VariableDefinitionDto } from './prompt.interfaces';

@ValidatorConstraint({ async: false })
export class DynamicObjectValidatorConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments): boolean {
        if (typeof value !== 'object' || value === null) {
            return false; // Not an object
        }

        // Validate each key-value pair in the object
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const variable = plainToClass(VariableDefinitionDto, value[key]);
                const errors = validateSync(variable); // Perform synchronous validation

                if (errors.length > 0) {
                    return false; // Validation failed
                }
            }
        }

        return true; // All properties are valid
    }

    defaultMessage(args: ValidationArguments): string {
        return `${args.property} must be an object with valid VariableDefinitionDto values.`;
    }
}

export function DynamicObjectValidator(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: DynamicObjectValidatorConstraint,
        });
    };
}
