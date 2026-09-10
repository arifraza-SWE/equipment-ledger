import type { CertificationType, Worker } from '@equipment-ledger/shared';

export type CertificationStanding =
  | { kind: 'not_required' }
  | { kind: 'valid'; expiresAt: string }
  | { kind: 'expired'; expiredAt: string }
  | { kind: 'not_yet_valid'; validFrom: string }
  | { kind: 'missing' };

export function certificationStanding(
  worker: Worker,
  required: CertificationType | null,
  atIso: string | null,
): CertificationStanding {
  if (required === null) {
    return { kind: 'not_required' };
  }
  const held = worker.certifications.filter((certification) => certification.type === required);
  if (held.length === 0) {
    return { kind: 'missing' };
  }
  const at = atIso ?? new Date().toISOString();
  const covering = held.find(
    (certification) => certification.issuedAt <= at && at < certification.expiresAt,
  );
  if (covering) {
    return { kind: 'valid', expiresAt: covering.expiresAt };
  }
  const latestExpiry = held.reduce((latest, certification) =>
    certification.expiresAt > latest.expiresAt ? certification : latest,
  );
  if (latestExpiry.expiresAt <= at) {
    return { kind: 'expired', expiredAt: latestExpiry.expiresAt };
  }
  const earliest = held.reduce((first, certification) =>
    certification.issuedAt < first.issuedAt ? certification : first,
  );
  return { kind: 'not_yet_valid', validFrom: earliest.issuedAt };
}

export function isCertificationExpired(expiresAt: string, atIso: string | null): boolean {
  return expiresAt <= (atIso ?? new Date().toISOString());
}
