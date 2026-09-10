import type { Asset, AssetStatus, ServiceStatus } from './assets';
import type { Correction, Movement } from './movements';
import type { Reservation } from './reservations';
import type { Keeper, Worker } from './workers';

export interface WorkerSummary {
  workerId: string;
  fullName: string;
}

export interface AssetHolding {
  movementId: string;
  worker: WorkerSummary;
  effectiveAt: string;
  dueAt: string | null;
  reservationId: string | null;
}

export interface AssetSnapshot {
  asset: Asset;
  status: AssetStatus;
  serviceStatus: ServiceStatus;
  holding: AssetHolding | null;
  overdue: boolean;
  currentReservation: Reservation | null;
  nextReservation: Reservation | null;
}

export interface StoreSnapshotTotals {
  assets: number;
  inStore: number;
  issued: number;
  overdue: number;
  reserved: number;
  outOfService: number;
}

export interface StoreSnapshot {
  asOf: string;
  storeOpenedAt: string | null;
  assets: AssetSnapshot[];
  totals: StoreSnapshotTotals;
}

export interface MovementWithNames {
  movement: Movement;
  worker: WorkerSummary | null;
  returnedBy: WorkerSummary | null;
  keeper: Keeper;
}

export interface AssetHistory {
  asset: Asset;
  snapshot: AssetSnapshot;
  movements: MovementWithNames[];
  corrections: Correction[];
  reservations: Reservation[];
}

export interface WorkerDetail {
  worker: Worker;
  holdings: AssetSnapshot[];
  recentMovements: MovementWithNames[];
  reservations: Reservation[];
}

export interface MovementResult {
  movement: Movement;
  asset: AssetSnapshot;
  serviceStatusChange: Movement | null;
  voidedReservations: Reservation[];
}

export interface CorrectionResult {
  correction: Correction;
  original: Movement;
  replacement: Movement | null;
  asset: AssetSnapshot;
}

export interface ServiceStatusChangeResult {
  movement: Movement;
  asset: AssetSnapshot;
  voidedReservations: Reservation[];
}

export interface PaginatedMovements {
  movements: MovementWithNames[];
  nextCursor: string | null;
}
