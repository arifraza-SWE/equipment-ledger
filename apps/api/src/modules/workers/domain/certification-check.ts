import { type CertificationType } from '@equipment-ledger/shared';

export interface HeldCertification {
  type: CertificationType;
  issuedAt: Date;
  expiresAt: Date;
}

export type CertificationCheck =
  | { qualified: true }
  | { qualified: false; reason: 'missing' }
  | { qualified: false; reason: 'expired'; expiredAt: Date }
  | { qualified: false; reason: 'not_yet_valid'; validFrom: Date };

/**
 * Validity is judged at the instant the asset changes hands, not at the instant the keeper
 * types it in. A certificate that ran out at 10:00 still covers an issue that happened at 09:00.
 */
export function checkCertification(
  held: readonly HeldCertification[],
  required: CertificationType | null,
  issueInstant: Date,
): CertificationCheck {
  if (required === null) {
    return { qualified: true };
  }
  const matching = held.filter((certification) => certification.type === required);
  if (matching.length === 0) {
    return { qualified: false, reason: 'missing' };
  }
  const covering = matching.find(
    (certification) => certification.issuedAt <= issueInstant && issueInstant < certification.expiresAt,
  );
  if (covering) {
    return { qualified: true };
  }
  const latestExpiry = matching.reduce((latest, certification) =>
    certification.expiresAt > latest.expiresAt ? certification : latest,
  );
  if (latestExpiry.expiresAt <= issueInstant) {
    return { qualified: false, reason: 'expired', expiredAt: latestExpiry.expiresAt };
  }
  const earliestStart = matching.reduce((earliest, certification) =>
    certification.issuedAt < earliest.issuedAt ? certification : earliest,
  );
  return { qualified: false, reason: 'not_yet_valid', validFrom: earliestStart.issuedAt };
}
