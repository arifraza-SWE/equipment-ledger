import { Matches } from 'class-validator';

export const IDENTIFIER_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

export function IsIdentifier(fieldName: string): PropertyDecorator {
  return Matches(IDENTIFIER_PATTERN, {
    message: `${fieldName} must look like HARN-014: 2 to 32 upper-case letters, digits or dashes`,
  });
}
