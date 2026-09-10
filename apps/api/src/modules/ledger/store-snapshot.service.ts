import { Inject, Injectable } from '@nestjs/common';
import type { AssetSnapshot, Reservation, StoreSnapshot } from '@equipment-ledger/shared';
import { NotFoundError } from '../../common/errors/domain-error';
import { CLOCK, type Clock } from '../../common/time/clock';
import { AssetsRepository, toAsset } from '../assets/assets.repository';
import { WorkersRepository } from '../workers/workers.repository';
import { assembleAssetSnapshot, countTotals } from './domain/asset-snapshot';
import { stateAt, type TimelineEntry } from './domain/asset-timeline';
import { MovementsRepository, toTimelineEntry } from './persistence/movements.repository';
import { type ReservationRecord } from './persistence/reservation.schema';
import {
  ReservationsRepository,
  standingAt,
  toReservation,
} from './persistence/reservations.repository';

@Injectable()
export class StoreSnapshotService {
  constructor(
    private readonly assets: AssetsRepository,
    private readonly workers: WorkersRepository,
    private readonly movements: MovementsRepository,
    private readonly reservations: ReservationsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The whole store as it stood at one instant, answered from the movements collection.
   * Nothing here reads a cached "current holder"; the same derivation serves the live dashboard
   * (instant = now) and any historical question.
   */
  async storeAt(instant: Date): Promise<StoreSnapshot> {
    const [storeOpenedAt, assetRecords, latestEntries, standingReservations] = await Promise.all([
      this.assets.findEarliestRegistration(),
      this.assets.findRegisteredBy(instant),
      this.movements.findLatestEffectivePerAsset(instant),
      this.reservations.findStandingAt(instant),
    ]);

    const reservationsByAsset = groupByAsset(standingReservations);
    const workerIds = [
      ...[...latestEntries.values()].map((entries) => entries.holding?.workerId ?? null),
      ...standingReservations.map((reservation) => reservation.workerId),
    ].filter((workerId): workerId is string => workerId !== null);
    const workerNames = await this.workerNames(workerIds);

    const snapshots = assetRecords.map((assetRecord) => {
      const latest = latestEntries.get(assetRecord._id);
      const holdingEntry =
        latest?.holding && latest.holding.type === 'issue' ? toTimelineEntry(latest.holding) : null;
      const serviceStatus =
        latest?.service?.type === 'out_of_service' ? 'out_of_service' : 'in_service';
      return assembleAssetSnapshot({
        asset: toAsset(assetRecord),
        holding: holdingEntry,
        serviceStatus,
        standingReservations: (reservationsByAsset.get(assetRecord._id) ?? []).map((record) =>
          toReservation(record, instant),
        ),
        workerNames,
        instant,
      });
    });

    return {
      asOf: instant.toISOString(),
      storeOpenedAt: storeOpenedAt ? storeOpenedAt.toISOString() : null,
      assets: snapshots,
      totals: countTotals(snapshots),
    };
  }

  async assetAt(assetId: string, instant: Date): Promise<AssetSnapshot> {
    const assetRecord = await this.assets.findById(assetId);
    if (!assetRecord) {
      throw new NotFoundError(`There is no asset ${assetId} in the store.`, { assetId });
    }
    const [timelineRecords, reservationRecords] = await Promise.all([
      this.movements.findEffectiveTimeline(assetId),
      this.reservations.findForAsset(assetId),
    ]);
    const timeline: TimelineEntry[] = timelineRecords.map(toTimelineEntry);
    const state = stateAt(timeline, instant);
    const standingReservations: Reservation[] = reservationRecords
      .filter((record) => standingAt(record, instant) !== null)
      .map((record) => toReservation(record, instant));
    const workerNames = await this.workerNames([
      state.holding?.workerId ?? null,
      ...standingReservations.map((reservation) => reservation.workerId),
    ]);

    return assembleAssetSnapshot({
      asset: toAsset(assetRecord),
      holding: state.holding,
      serviceStatus: state.serviceStatus,
      standingReservations,
      workerNames,
      instant,
    });
  }

  async assetNow(assetId: string): Promise<AssetSnapshot> {
    return this.assetAt(assetId, this.clock.now());
  }

  private async workerNames(workerIds: ReadonlyArray<string | null>): Promise<Map<string, string>> {
    const presentIds = workerIds.filter((workerId): workerId is string => workerId !== null);
    const records = await this.workers.findByIds(presentIds);
    return new Map([...records.values()].map((record) => [record._id, record.fullName]));
  }
}

function groupByAsset(
  reservations: readonly ReservationRecord[],
): Map<string, ReservationRecord[]> {
  const grouped = new Map<string, ReservationRecord[]>();
  for (const reservation of reservations) {
    const forAsset = grouped.get(reservation.assetId) ?? [];
    forAsset.push(reservation);
    grouped.set(reservation.assetId, forAsset);
  }
  return grouped;
}
