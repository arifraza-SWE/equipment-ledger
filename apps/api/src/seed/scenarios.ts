import type { SeedClock } from './anchor';

/**
 * One loan: an issue, and usually a return. `recordedAt` values default to a few minutes after
 * the effective time; the late entry and the correction override that explicitly.
 */
export interface SeedLoan {
  label: string;
  assetId: string;
  workerId: string;
  keeperId: string;
  issuedAt: Date;
  issueRecordedAt?: Date;
  dueAt: Date;
  returnedAt: Date | null;
  returnRecordedAt?: Date;
  returnedByWorkerId?: string;
  reservationLabel?: string;
  issueNote?: string;
  returnNote?: string;
  withdrawnOnReturn?: string;
}

export interface SeedReservation {
  label: string;
  assetId: string;
  workerId: string;
  keeperId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  note?: string;
  outcome:
    | { kind: 'standing' }
    | { kind: 'fulfilled' }
    | { kind: 'cancelled'; closedAt: Date }
    | { kind: 'voided'; closedAt: Date; reason: string };
}

export interface SeedServiceEvent {
  label: string;
  assetId: string;
  keeperId: string;
  type: 'out_of_service' | 'back_in_service';
  effectiveAt: Date;
  recordedAt?: Date;
  note: string;
}

export interface SeedCorrection {
  label: string;
  targetLoanLabel: string;
  targetMovement: 'issue' | 'return';
  keeperId: string;
  recordedAt: Date;
  reason: string;
  newEffectiveAt: Date;
}

export interface SeedScenarios {
  loans: SeedLoan[];
  reservations: SeedReservation[];
  serviceEvents: SeedServiceEvent[];
  corrections: SeedCorrection[];
}

/** Assets whose ledgers are written by hand below; the routine generator leaves them alone. */
export const SCENARIO_ASSETS = new Set([
  'DRL-003',
  'HARN-014',
  'GAS-004',
  'DRL-007',
  'GRN-002',
  'TWR-001',
  'TWR-002',
  'GAS-002',
  'SAW-003',
  'HARN-003',
  'LVL-002',
  'LAD-002',
  'DRL-001',
  'HARN-005',
  'HARN-002',
  'GAS-001',
  'DRL-004',
  'LVL-001',
]);

export const OUT_OF_SERVICE_VOID_REASON = 'Asset taken out of service';

export function buildScenarios(clock: SeedClock): SeedScenarios {
  const loans: SeedLoan[] = [
    // Ordinary past loans on the demo assets, so their history pages have something to show.
    loan('HARN-014 twelve days ago', 'HARN-014', 'WKR-002', 'KPR-01', clock, -12, '07:30', '16:20'),
    loan('HARN-014 six days ago', 'HARN-014', 'WKR-001', 'KPR-02', clock, -6, '07:45', '15:50'),
    loan('DRL-003 eight days ago', 'DRL-003', 'WKR-006', 'KPR-01', clock, -8, '08:00', '16:30'),
    loan('DRL-003 three days ago', 'DRL-003', 'WKR-008', 'KPR-03', clock, -3, '07:50', '16:05'),
    // WKR-007 held a gas detector while the certificate was still valid; today the same request is refused.
    loan('GAS-004 ten days ago', 'GAS-004', 'WKR-007', 'KPR-01', clock, -10, '07:35', '16:00'),
    loan('GAS-004 four days ago', 'GAS-004', 'WKR-005', 'KPR-02', clock, -4, '07:40', '15:45'),
    // Historical reconstruction target: two days ago at 14:20, GAS-001 was with WKR-005.
    loan('GAS-001 two days ago', 'GAS-001', 'WKR-005', 'KPR-01', clock, -2, '07:50', '16:10'),
    loan('GAS-001 nine days ago', 'GAS-001', 'WKR-003', 'KPR-02', clock, -9, '08:05', '16:40'),
    // Late-logged entry: returned at 09:00, written into the book at 11:40.
    {
      ...loan('LAD-002 late entry', 'LAD-002', 'WKR-008', 'KPR-01', clock, -5, '07:45', '09:00'),
      returnRecordedAt: clock.at(-5, '11:40'),
      returnNote: 'Brought back after the first fix; logged late, hatch was busy',
    },
    loan('LAD-002 fifteen days ago', 'LAD-002', 'WKR-011', 'KPR-03', clock, -15, '07:55', '16:25'),
    // Correction target: the return was written as 17:00, the keeper corrects it to 15:30.
    loan('GRN-002 corrected return', 'GRN-002', 'WKR-009', 'KPR-02', clock, -9, '07:40', '17:00'),
    loan('GRN-002 twenty days ago', 'GRN-002', 'WKR-010', 'KPR-01', clock, -20, '07:30', '16:00'),
    // Reservation collected on time.
    {
      ...loan('HARN-005 against reservation', 'HARN-005', 'WKR-001', 'KPR-01', clock, -7, '07:55', '15:30'),
      dueAt: clock.at(-7, '16:00'),
      reservationLabel: 'HARN-005 reservation',
    },
    // Returned damaged and withdrawn at the same instant.
    {
      ...loan('SAW-003 returned damaged', 'SAW-003', 'WKR-010', 'KPR-03', clock, -2, '07:30', '15:45'),
      returnNote: 'Blade guard cracked',
      withdrawnOnReturn: 'Blade guard cracked, sent for repair',
    },
    loan('SAW-003 eleven days ago', 'SAW-003', 'WKR-007', 'KPR-01', clock, -11, '07:35', '16:15'),
    // GAS-002 was fine until it failed its bump test six days ago.
    loan('GAS-002 fourteen days ago', 'GAS-002', 'WKR-003', 'KPR-02', clock, -14, '07:45', '16:00'),
    // Still out.
    {
      ...loan('HARN-003 overdue', 'HARN-003', 'WKR-004', 'KPR-01', clock, -4, '07:30', null),
      dueAt: clock.at(-4, '17:00'),
    },
    {
      ...loan('DRL-007 outstanding', 'DRL-007', 'WKR-006', 'KPR-02', clock, -1, '07:35', null),
      dueAt: clock.at(1, '17:00'),
    },
    {
      ...loan('LVL-002 outstanding', 'LVL-002', 'WKR-011', 'KPR-03', clock, -1, '08:05', null),
      dueAt: clock.at(1, '17:00'),
    },
    // Returned by a colleague on the holder's behalf.
    {
      ...loan('TWR-002 returned by colleague', 'TWR-002', 'WKR-012', 'KPR-01', clock, -6, '07:50', '16:35'),
      returnedByWorkerId: 'WKR-001',
      returnNote: 'Handed back by Amira; Ewan left site early',
    },
  ];

  const reservations: SeedReservation[] = [
    {
      label: 'HARN-005 reservation',
      assetId: 'HARN-005',
      workerId: 'WKR-001',
      keeperId: 'KPR-01',
      startsAt: clock.at(-7, '08:00'),
      endsAt: clock.at(-7, '16:00'),
      createdAt: clock.at(-9, '14:10'),
      outcome: { kind: 'fulfilled' },
    },
    {
      label: 'DRL-001 never collected',
      assetId: 'DRL-001',
      workerId: 'WKR-009',
      keeperId: 'KPR-02',
      startsAt: clock.at(-3, '09:00'),
      endsAt: clock.at(-3, '12:00'),
      createdAt: clock.at(-4, '16:20'),
      note: 'Wanted for the plant room second fix',
      outcome: { kind: 'standing' },
    },
    {
      label: 'GAS-002 voided by withdrawal',
      assetId: 'GAS-002',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      startsAt: clock.at(-5, '08:00'),
      endsAt: clock.at(-5, '12:00'),
      createdAt: clock.at(-8, '15:00'),
      outcome: { kind: 'voided', closedAt: clock.at(-6, '10:15'), reason: OUT_OF_SERVICE_VOID_REASON },
    },
    {
      label: 'LAD-002 cancelled',
      assetId: 'LAD-002',
      workerId: 'WKR-006',
      keeperId: 'KPR-03',
      startsAt: clock.at(-12, '08:00'),
      endsAt: clock.at(-12, '12:00'),
      createdAt: clock.at(-13, '11:00'),
      outcome: { kind: 'cancelled', closedAt: clock.at(-13, '16:45') },
    },
    // The future: the conflict demo targets TWR-001's Thursday morning window.
    {
      label: 'TWR-001 future',
      assetId: 'TWR-001',
      workerId: 'WKR-003',
      keeperId: 'KPR-01',
      startsAt: clock.at(2, '08:00'),
      endsAt: clock.at(2, '12:00'),
      createdAt: clock.at(-1, '15:30'),
      note: 'Atrium ceiling grid',
      outcome: { kind: 'standing' },
    },
    {
      label: 'HARN-002 future',
      assetId: 'HARN-002',
      workerId: 'WKR-002',
      keeperId: 'KPR-02',
      startsAt: clock.at(1, '08:00'),
      endsAt: clock.at(1, '16:00'),
      createdAt: clock.at(-1, '16:05'),
      outcome: { kind: 'standing' },
    },
    {
      label: 'GAS-001 future',
      assetId: 'GAS-001',
      workerId: 'WKR-005',
      keeperId: 'KPR-01',
      startsAt: clock.at(3, '07:00'),
      endsAt: clock.at(3, '15:00'),
      createdAt: clock.at(-2, '16:30'),
      note: 'Manhole survey, north drain run',
      outcome: { kind: 'standing' },
    },
    {
      label: 'TWR-002 future',
      assetId: 'TWR-002',
      workerId: 'WKR-012',
      keeperId: 'KPR-03',
      startsAt: clock.at(4, '08:00'),
      endsAt: clock.at(4, '17:00'),
      createdAt: clock.at(-1, '09:15'),
      outcome: { kind: 'standing' },
    },
    {
      label: 'DRL-004 future',
      assetId: 'DRL-004',
      workerId: 'WKR-012',
      keeperId: 'KPR-02',
      startsAt: clock.at(1, '13:00'),
      endsAt: clock.at(1, '17:00'),
      createdAt: clock.at(-1, '12:40'),
      outcome: { kind: 'standing' },
    },
    // Adjacent windows on one asset: allowed, because 12:00 ends one and starts the other.
    {
      label: 'LVL-001 morning',
      assetId: 'LVL-001',
      workerId: 'WKR-009',
      keeperId: 'KPR-01',
      startsAt: clock.at(2, '08:00'),
      endsAt: clock.at(2, '12:00'),
      createdAt: clock.at(-3, '10:00'),
      outcome: { kind: 'standing' },
    },
    {
      label: 'LVL-001 afternoon',
      assetId: 'LVL-001',
      workerId: 'WKR-010',
      keeperId: 'KPR-01',
      startsAt: clock.at(2, '12:00'),
      endsAt: clock.at(2, '16:00'),
      createdAt: clock.at(-3, '10:05'),
      outcome: { kind: 'standing' },
    },
  ];

  const serviceEvents: SeedServiceEvent[] = [
    {
      label: 'GAS-002 failed bump test',
      assetId: 'GAS-002',
      keeperId: 'KPR-01',
      type: 'out_of_service',
      effectiveAt: clock.at(-6, '10:15'),
      note: 'Failed bump test on CO cell; sent for calibration',
    },
  ];

  const corrections: SeedCorrection[] = [
    {
      label: 'GRN-002 return time corrected',
      targetLoanLabel: 'GRN-002 corrected return',
      targetMovement: 'return',
      keeperId: 'KPR-02',
      recordedAt: clock.at(-9, '17:40'),
      reason: 'Wrote 17:00 from memory; the hatch sheet says Marcus handed it in at 15:30',
      newEffectiveAt: clock.at(-9, '15:30'),
    },
  ];

  return { loans, reservations, serviceEvents, corrections };
}

function loan(
  label: string,
  assetId: string,
  workerId: string,
  keeperId: string,
  clock: SeedClock,
  dayOffset: number,
  issuedClock: string,
  returnedClock: string | null,
): SeedLoan {
  return {
    label,
    assetId,
    workerId,
    keeperId,
    issuedAt: clock.at(dayOffset, issuedClock),
    dueAt: clock.at(dayOffset, '17:00'),
    returnedAt: returnedClock ? clock.at(dayOffset, returnedClock) : null,
  };
}
