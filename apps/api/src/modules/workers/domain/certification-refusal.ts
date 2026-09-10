import { CERTIFICATION_LABELS, type CertificationType } from '@equipment-ledger/shared';
import { RuleViolationError } from '../../../common/errors/domain-error';

import type { CertificationCheck } from './certification-check';
import { isoDate } from '../../../config/site-time';

export interface CertificationRefusalContext {
  workerId: string;
  workerName: string;
  assetId: string;
  requiredCertification: CertificationType;
  purpose: 'receive' | 'reserve';
}

export function certificationRefusal(
  check: Exclude<CertificationCheck, { qualified: true }>,
  context: CertificationRefusalContext,
): RuleViolationError {
  const who = `${context.workerName} (${context.workerId})`;
  const label = CERTIFICATION_LABELS[context.requiredCertification];
  const details = {
    workerId: context.workerId,
    assetId: context.assetId,
    requiredCertification: context.requiredCertification,
  };

  switch (check.reason) {
    case 'missing':
      return new RuleViolationError(
        'certification_missing',
        `${who} cannot ${context.purpose} ${context.assetId} because it requires a ${label} certification and they do not hold one.`,
        details,
      );
    case 'expired':
      return new RuleViolationError(
        'certification_expired',
        `${who} cannot ${context.purpose} ${context.assetId} because the required ${label} certification expired on ${isoDate(check.expiredAt)}.`,
        { ...details, expiredAt: check.expiredAt.toISOString() },
      );
    case 'not_yet_valid':
      return new RuleViolationError(
        'certification_expired',
        `${who} cannot ${context.purpose} ${context.assetId} because their ${label} certification is not valid until ${isoDate(check.validFrom)}.`,
        { ...details, validFrom: check.validFrom.toISOString() },
      );
  }
}
