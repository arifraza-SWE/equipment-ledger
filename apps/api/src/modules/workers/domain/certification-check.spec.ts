import { checkCertification, type HeldCertification } from './certification-check';

const gasCertificate: HeldCertification = {
  type: 'gas_detection',
  issuedAt: new Date('2025-01-01T00:00:00Z'),
  expiresAt: new Date('2026-09-09T23:59:59Z'),
};

describe('checkCertification', () => {
  it('always qualifies when the asset needs no certificate', () => {
    expect(checkCertification([], null, new Date('2026-09-10T09:00:00Z'))).toEqual({
      qualified: true,
    });
  });

  it('refuses a worker with no certificate of the required type', () => {
    expect(
      checkCertification([gasCertificate], 'working_at_height', new Date('2026-09-01T09:00:00Z')),
    ).toEqual({
      qualified: false,
      reason: 'missing',
    });
  });

  it('judges validity at the issue instant, not at the time of asking', () => {
    const yesterdayMorning = new Date('2026-09-09T09:00:00Z');
    expect(checkCertification([gasCertificate], 'gas_detection', yesterdayMorning)).toEqual({
      qualified: true,
    });
  });

  it('refuses once the certificate has expired at the issue instant', () => {
    expect(
      checkCertification([gasCertificate], 'gas_detection', new Date('2026-09-10T09:00:00Z')),
    ).toEqual({
      qualified: false,
      reason: 'expired',
      expiredAt: gasCertificate.expiresAt,
    });
  });

  it('refuses at the exact expiry instant', () => {
    expect(
      checkCertification([gasCertificate], 'gas_detection', gasCertificate.expiresAt),
    ).toMatchObject({
      qualified: false,
      reason: 'expired',
    });
  });

  it('refuses before the certificate became valid', () => {
    expect(
      checkCertification([gasCertificate], 'gas_detection', new Date('2024-12-31T00:00:00Z')),
    ).toEqual({
      qualified: false,
      reason: 'not_yet_valid',
      validFrom: gasCertificate.issuedAt,
    });
  });

  it('accepts a renewal that covers the instant when an older certificate has lapsed', () => {
    const renewal: HeldCertification = {
      type: 'gas_detection',
      issuedAt: new Date('2026-09-05T00:00:00Z'),
      expiresAt: new Date('2027-09-05T00:00:00Z'),
    };
    expect(
      checkCertification(
        [gasCertificate, renewal],
        'gas_detection',
        new Date('2026-09-12T09:00:00Z'),
      ),
    ).toEqual({
      qualified: true,
    });
  });
});
