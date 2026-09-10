import { RuleViolationError } from '../errors/domain-error';
import { parseInstant } from './instant';

export function requireInstant(candidate: string, fieldName: string): Date {
  const parsed = parseInstant(candidate);
  if (!parsed) {
    throw new RuleViolationError('validation_failed', `${fieldName} must be an ISO 8601 timestamp with a timezone.`);
  }
  return parsed;
}
