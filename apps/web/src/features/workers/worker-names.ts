import type { Worker } from '@equipment-ledger/shared';

export type WorkerNamesById = Readonly<Record<string, string>>;

export function indexWorkerNames(workers: readonly Worker[]): WorkerNamesById {
  return Object.fromEntries(workers.map((worker) => [worker.workerId, worker.fullName]));
}

export function workerNameOr(workerNamesById: WorkerNamesById, workerId: string): string {
  return workerNamesById[workerId] ?? workerId;
}
