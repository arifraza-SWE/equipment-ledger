import type { SeedClock } from './anchor';
import { SCENARIO_ASSETS, type SeedLoan } from './scenarios';

interface LoanPool {
  name: string;
  assetIds: string[];
  workerIds: string[];
}

const POOLS: LoanPool[] = [
  {
    name: 'general',
    assetIds: [
      'DRL-002',
      'DRL-005',
      'DRL-006',
      'DRL-008',
      'DRL-009',
      'DRL-010',
      'LAD-001',
      'LAD-003',
      'LAD-004',
      'LAD-005',
      'LAD-006',
      'LAD-007',
      'LAD-008',
      'LVL-003',
      'LVL-004',
      'RAD-001',
      'RAD-002',
      'RAD-003',
      'RAD-004',
    ],
    workerIds: ['WKR-006', 'WKR-008', 'WKR-011', 'WKR-002', 'WKR-009', 'WKR-004'],
  },
  {
    name: 'height',
    assetIds: [
      'HARN-001',
      'HARN-004',
      'HARN-006',
      'HARN-007',
      'HARN-008',
      'HARN-009',
      'HARN-010',
      'HARN-011',
      'HARN-012',
      'HARN-013',
    ],
    workerIds: ['WKR-001', 'WKR-002', 'WKR-003', 'WKR-005', 'WKR-012'],
  },
  {
    name: 'gas',
    assetIds: ['GAS-003', 'GAS-005', 'GAS-006'],
    workerIds: ['WKR-003', 'WKR-005', 'WKR-007'],
  },
  {
    name: 'abrasive',
    assetIds: [
      'GRN-001',
      'GRN-003',
      'GRN-004',
      'GRN-005',
      'GRN-006',
      'SAW-001',
      'SAW-002',
      'SAW-004',
    ],
    workerIds: ['WKR-007', 'WKR-009', 'WKR-010'],
  },
  {
    name: 'tower',
    assetIds: ['TWR-003', 'TWR-004'],
    workerIds: ['WKR-001', 'WKR-003', 'WKR-012'],
  },
];

const KEEPER_ROTA = ['KPR-01', 'KPR-02', 'KPR-03'];
const FIRST_DAY_OFFSET = -30;
const LAST_DAY_OFFSET = -1;

function loansForWeekday(weekday: number): number {
  if (weekday === 0) {
    return 0;
  }
  return weekday === 6 ? 2 : 5;
}

/**
 * Thirty days of unremarkable same-day loans. Nothing is random: the day offset and the loan's
 * position in the day pick the pool, the asset, the worker and the keeper.
 */
export function buildRoutineLoans(clock: SeedClock): SeedLoan[] {
  const loans: SeedLoan[] = [];

  for (let dayOffset = FIRST_DAY_OFFSET; dayOffset <= LAST_DAY_OFFSET; dayOffset += 1) {
    const dayIndex = dayOffset - FIRST_DAY_OFFSET;
    const usedToday = new Set<string>();

    for (let position = 0; position < loansForWeekday(clock.weekday(dayOffset)); position += 1) {
      const pool = POOLS[(dayIndex + position) % POOLS.length];
      if (!pool) {
        continue;
      }
      const assetId = pool.assetIds[(dayIndex * 3 + position) % pool.assetIds.length];
      const workerId = pool.workerIds[(dayIndex + position * 2) % pool.workerIds.length];
      const keeperId = KEEPER_ROTA[(dayIndex + position) % KEEPER_ROTA.length];
      if (
        !assetId ||
        !workerId ||
        !keeperId ||
        usedToday.has(assetId) ||
        SCENARIO_ASSETS.has(assetId)
      ) {
        continue;
      }
      usedToday.add(assetId);

      loans.push({
        label: `routine ${assetId} day ${dayOffset}`,
        assetId,
        workerId,
        keeperId,
        issuedAt: clock.at(dayOffset, minutesToClock(7 * 60 + 30 + position * 6)),
        dueAt: clock.at(dayOffset, '17:00'),
        returnedAt: clock.at(dayOffset, minutesToClock(16 * 60 + position * 5)),
      });
    }
  }

  return loans;
}

function minutesToClock(totalMinutes: number): string {
  const hoursPart = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;
  return `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`;
}
