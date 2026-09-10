import { fingerprintRequest } from './request-fingerprint';

describe('fingerprintRequest', () => {
  const body = {
    assetId: 'HARN-014',
    workerId: 'WKR-003',
    nested: { effectiveAt: '2026-09-10T07:30:00Z', note: null },
  };

  it('does not depend on property order', () => {
    const reordered = {
      nested: { note: null, effectiveAt: '2026-09-10T07:30:00Z' },
      workerId: 'WKR-003',
      assetId: 'HARN-014',
    };
    expect(fingerprintRequest('POST', '/movements/issues', body)).toBe(
      fingerprintRequest('POST', '/movements/issues', reordered),
    );
  });

  it('changes when any value changes', () => {
    expect(fingerprintRequest('POST', '/movements/issues', body)).not.toBe(
      fingerprintRequest('POST', '/movements/issues', { ...body, workerId: 'WKR-004' }),
    );
  });

  it('changes with the route, so one key cannot be replayed against another endpoint', () => {
    expect(fingerprintRequest('POST', '/movements/issues', body)).not.toBe(
      fingerprintRequest('POST', '/movements/returns', body),
    );
  });

  it('ignores undefined properties, which JSON would have dropped anyway', () => {
    expect(fingerprintRequest('POST', '/x', { ...body, extra: undefined })).toBe(
      fingerprintRequest('POST', '/x', body),
    );
  });
});
