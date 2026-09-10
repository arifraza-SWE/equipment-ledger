import { Injectable } from '@nestjs/common';
import type { MovementWithNames } from '@equipment-ledger/shared';
import { KeepersRepository, toKeeper } from '../keepers/keepers.repository';
import { toWorkerSummary, WorkersRepository } from '../workers/workers.repository';
import { type MovementRecord } from './persistence/movement.schema';
import { toMovement } from './persistence/movements.repository';

@Injectable()
export class MovementNamesService {
  constructor(
    private readonly workers: WorkersRepository,
    private readonly keepers: KeepersRepository,
  ) {}

  async attachNames(records: readonly MovementRecord[]): Promise<MovementWithNames[]> {
    const workerIds = records.flatMap((record) => [record.workerId, record.returnedByWorkerId]);
    const [workersById, keepersById] = await Promise.all([
      this.workers.findByIds(workerIds.filter((workerId): workerId is string => workerId !== null)),
      this.keepers.findByIds(records.map((record) => record.keeperId)),
    ]);

    return records.map((record) => {
      const worker = record.workerId ? workersById.get(record.workerId) : undefined;
      const returnedBy = record.returnedByWorkerId
        ? workersById.get(record.returnedByWorkerId)
        : undefined;
      const keeper = keepersById.get(record.keeperId);
      return {
        movement: toMovement(record),
        worker: worker ? toWorkerSummary(worker) : null,
        returnedBy: returnedBy ? toWorkerSummary(returnedBy) : null,
        keeper: keeper
          ? toKeeper(keeper)
          : { keeperId: record.keeperId, fullName: record.keeperId },
      };
    });
  }
}
