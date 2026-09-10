import { registerDecorator, type ValidationOptions } from 'class-validator';
import { parseInstant } from '../time/instant';

export function IsInstant(options?: ValidationOptions) {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: 'isInstant',
      target: target.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an ISO 8601 timestamp with a timezone, e.g. 2026-09-08T09:00:00Z`,
        ...options,
      },
      validator: {
        validate(candidate: unknown): boolean {
          return typeof candidate === 'string' && parseInstant(candidate) !== null;
        },
      },
    });
  };
}
