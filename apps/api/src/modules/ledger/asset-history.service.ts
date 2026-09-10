import { Inject, Injectable } from '@nestjs/common';
import type { AssetHistory } from '@equipment-ledger/shared';
import { NotFoundError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { AssetsRepository, toAsset } from '../assets/assets.repository';
import { MovementNamesService } from './movement-names.service';
import { CorrectionsRepository, toCorrection } from './persistence/corrections.repository';
import { MovementsRepository } from './persistence/movements.repository';
import { ReservationsRepository, toReservation } from './persistence/reservations.repository';
import { StoreSnapshotService } from './store-snapshot.service';

@Injectable()
export class AssetHistoryService {
  constructor(
    private readonly assets: AssetsRepository,
    private readonly movements: MovementsRepository,
    private readonly corrections: CorrectionsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly names: MovementNamesService,
    private readonly snapshots: StoreSnapshotService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async historyOf(assetId: string): Promise<AssetHistory> {
    const assetRecord = await this.assets.findById(assetId);
    if (!assetRecord) {
      throw new NotFoundError(`There is no asset ${assetId} in the store.`, { assetId });
    }
    const now = this.clock.now();
    const [movementRecords, correctionRecords, reservationRecords, snapshot] = await Promise.all([
      this.movements.findAllForAsset(assetId),
      this.corrections.findForAsset(assetId),
      this.reservations.findForAsset(assetId),
      this.snapshots.assetAt(assetId, now),
    ]);

    return {
      asset: toAsset(assetRecord),
      snapshot,
      movements: await this.names.attachNames(movementRecords),
      corrections: correctionRecords.map(toCorrection),
      reservations: reservationRecords.map((record) => toReservation(record, now)),
    };
  }
}
