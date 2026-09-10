import { Inject, Injectable } from '@nestjs/common';
import type { WorkerDetail } from '@equipment-ledger/shared';
import { NotFoundError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { toWorker, WorkersRepository } from '../workers/workers.repository';
import { MovementNamesService } from './movement-names.service';
import { MovementsRepository } from './persistence/movements.repository';
import { ReservationsRepository, toReservation } from './persistence/reservations.repository';
import { StoreSnapshotService } from './store-snapshot.service';

const RECENT_MOVEMENT_LIMIT = 25;

@Injectable()
export class WorkerDetailService {
  constructor(
    private readonly workers: WorkersRepository,
    private readonly movements: MovementsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly names: MovementNamesService,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async detailOf(workerId: string): Promise<WorkerDetail> {
    const workerRecord = await this.workers.findById(workerId);
    if (!workerRecord) {
      throw new NotFoundError(`There is no worker ${workerId}.`, { workerId });
    }
    const now = this.clock.now();
    const [store, recentRecords, reservationRecords] = await Promise.all([
      this.snapshots.storeAt(now),
      this.movements.findRecentForWorker(workerId, RECENT_MOVEMENT_LIMIT),
      this.reservations.list({ workerId }),
    ]);

    return {
      worker: toWorker(workerRecord),
      holdings: store.assets.filter((snapshot) => snapshot.holding?.worker.workerId === workerId),
      recentMovements: await this.names.attachNames(recentRecords),
      reservations: reservationRecords.map((record) => toReservation(record, now)),
    };
  }
}
