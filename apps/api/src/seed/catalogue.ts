import type { AssetKind, CertificationType, Keeper } from '@equipment-ledger/shared';
import type { SeedClock } from './anchor';

export interface SeedAsset {
  assetId: string;
  kind: AssetKind;
  description: string;
  requiredCertification: CertificationType | null;
}

export interface SeedWorker {
  workerId: string;
  fullName: string;
  trade: string;
  certifications: Array<{
    type: CertificationType;
    issuedDayOffset: number;
    expiresDayOffset: number;
  }>;
}

interface AssetRange {
  prefix: string;
  count: number;
  kind: AssetKind;
  requiredCertification: CertificationType | null;
  models: string[];
}

const ASSET_RANGES: AssetRange[] = [
  {
    prefix: 'HARN',
    count: 14,
    kind: 'harness',
    requiredCertification: 'working_at_height',
    models: [
      'Petzl Avao Bod full-body harness',
      'Honeywell Titan 2-point harness',
      'Kratos FA 10 103 harness',
    ],
  },
  {
    prefix: 'GAS',
    count: 6,
    kind: 'gas_detector',
    requiredCertification: 'gas_detection',
    models: ['Draeger X-am 2500 four-gas detector', 'Crowcon Gas-Pro five-gas detector'],
  },
  {
    prefix: 'DRL',
    count: 10,
    kind: 'cordless_drill',
    requiredCertification: null,
    models: [
      'Makita DHP486 18V combi drill',
      'DeWalt DCD996 18V combi drill',
      'Hilti TE 6-A22 rotary hammer',
    ],
  },
  {
    prefix: 'GRN',
    count: 6,
    kind: 'angle_grinder',
    requiredCertification: 'abrasive_wheels',
    models: ['Bosch GWS 18V-10 115mm grinder', 'Makita GA9020 230mm grinder'],
  },
  {
    prefix: 'LAD',
    count: 8,
    kind: 'ladder',
    requiredCertification: null,
    models: [
      'Werner 6-tread platform step',
      'Lyte 3-section extension ladder',
      'Zarges 8-tread step',
    ],
  },
  {
    prefix: 'LVL',
    count: 4,
    kind: 'laser_level',
    requiredCertification: null,
    models: ['Leica Lino L2P5 cross-line laser', 'Bosch GRL 400 H rotary laser'],
  },
  {
    prefix: 'TWR',
    count: 4,
    kind: 'mobile_tower',
    requiredCertification: 'mobile_tower',
    models: ['Boss X3 single-width tower, 4.2m', 'Boss Clima double-width tower, 6.2m'],
  },
  {
    prefix: 'SAW',
    count: 4,
    kind: 'cut_off_saw',
    requiredCertification: 'abrasive_wheels',
    models: ['Stihl TS 420 petrol cut-off saw', 'Husqvarna K770 cut-off saw'],
  },
  {
    prefix: 'RAD',
    count: 4,
    kind: 'two_way_radio',
    requiredCertification: null,
    models: ['Motorola DP1400 two-way radio'],
  },
];

export function buildAssetCatalogue(): SeedAsset[] {
  return ASSET_RANGES.flatMap((range) =>
    Array.from({ length: range.count }, (_, index) => ({
      assetId: `${range.prefix}-${String(index + 1).padStart(3, '0')}`,
      kind: range.kind,
      description: range.models[index % range.models.length] ?? range.models[0] ?? range.kind,
      requiredCertification: range.requiredCertification,
    })),
  );
}

/**
 * WKR-007's gas certificate ran out yesterday and WKR-004's harness certificate runs out in
 * three days; both are referenced by name in the README's demo script.
 */
export const WORKERS: SeedWorker[] = [
  {
    workerId: 'WKR-001',
    fullName: 'Amira Haddad',
    trade: 'Scaffolder',
    certifications: [
      { type: 'working_at_height', issuedDayOffset: -400, expiresDayOffset: 330 },
      { type: 'mobile_tower', issuedDayOffset: -300, expiresDayOffset: 430 },
    ],
  },
  {
    workerId: 'WKR-002',
    fullName: 'Tomasz Nowak',
    trade: 'Steel fixer',
    certifications: [{ type: 'working_at_height', issuedDayOffset: -250, expiresDayOffset: 480 }],
  },
  {
    workerId: 'WKR-003',
    fullName: 'Priya Raman',
    trade: 'Site supervisor',
    certifications: [
      { type: 'working_at_height', issuedDayOffset: -600, expiresDayOffset: 130 },
      { type: 'mobile_tower', issuedDayOffset: -500, expiresDayOffset: 230 },
      { type: 'gas_detection', issuedDayOffset: -120, expiresDayOffset: 610 },
    ],
  },
  {
    workerId: 'WKR-004',
    fullName: 'Callum Reid',
    trade: 'Roofer',
    certifications: [{ type: 'working_at_height', issuedDayOffset: -727, expiresDayOffset: 3 }],
  },
  {
    workerId: 'WKR-005',
    fullName: 'Daniel Okafor',
    trade: 'Confined space operative',
    certifications: [
      { type: 'gas_detection', issuedDayOffset: -90, expiresDayOffset: 640 },
      { type: 'working_at_height', issuedDayOffset: -90, expiresDayOffset: 640 },
    ],
  },
  { workerId: 'WKR-006', fullName: 'Sofia Marchetti', trade: 'Electrician', certifications: [] },
  {
    workerId: 'WKR-007',
    fullName: 'Liam Doherty',
    trade: 'Groundworker',
    certifications: [
      { type: 'gas_detection', issuedDayOffset: -731, expiresDayOffset: -1 },
      { type: 'abrasive_wheels', issuedDayOffset: -200, expiresDayOffset: 530 },
    ],
  },
  { workerId: 'WKR-008', fullName: 'Hana Kovac', trade: 'Joiner', certifications: [] },
  {
    workerId: 'WKR-009',
    fullName: 'Marcus Bell',
    trade: 'Bricklayer',
    certifications: [{ type: 'abrasive_wheels', issuedDayOffset: -150, expiresDayOffset: 580 }],
  },
  {
    workerId: 'WKR-010',
    fullName: 'Yusuf Demir',
    trade: 'Groundworker',
    certifications: [{ type: 'abrasive_wheels', issuedDayOffset: -320, expiresDayOffset: 410 }],
  },
  {
    workerId: 'WKR-011',
    fullName: 'Grace Whitfield',
    trade: 'Setting-out engineer',
    certifications: [],
  },
  {
    workerId: 'WKR-012',
    fullName: 'Ewan MacLeod',
    trade: 'Plant operator',
    certifications: [
      { type: 'mobile_tower', issuedDayOffset: -100, expiresDayOffset: 630 },
      { type: 'working_at_height', issuedDayOffset: -100, expiresDayOffset: 630 },
    ],
  },
];

export const KEEPERS: Keeper[] = [
  { keeperId: 'KPR-01', fullName: 'Dave Mullins' },
  { keeperId: 'KPR-02', fullName: 'Rosa Alvarez' },
  { keeperId: 'KPR-03', fullName: 'Ben Osei' },
];

export function workerCertificationDates(worker: SeedWorker, clock: SeedClock) {
  return worker.certifications.map((certification) => ({
    type: certification.type,
    issuedAt: clock.at(certification.issuedDayOffset, '00:00'),
    expiresAt: clock.endOfDay(certification.expiresDayOffset),
  }));
}
