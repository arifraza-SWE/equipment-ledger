import type { Connection } from 'mongoose';
import type { MovementRecord } from '../../src/modules/ledger/persistence/movement.schema';
import type { ReservationRecord } from '../../src/modules/ledger/persistence/reservation.schema';

export async function readMovements(
  connection: Connection,
  assetId?: string,
): Promise<MovementRecord[]> {
  const filter = assetId ? { assetId } : {};
  return connection
    .collection<MovementRecord>('movements')
    .find(filter)
    .sort({ effectiveAt: 1, sequence: 1 })
    .toArray();
}

export async function readEffectiveMovements(
  connection: Connection,
  assetId?: string,
): Promise<MovementRecord[]> {
  const all = await readMovements(connection, assetId);
  return all.filter((movement) => movement.supersededByCorrectionId === null);
}

export async function readReservations(
  connection: Connection,
  assetId?: string,
): Promise<ReservationRecord[]> {
  const filter = assetId ? { assetId } : {};
  return connection
    .collection<ReservationRecord>('reservations')
    .find(filter)
    .sort({ startsAt: 1 })
    .toArray();
}

export async function countIssuesAt(
  connection: Connection,
  assetId: string,
  effectiveAt: string,
): Promise<number> {
  return connection
    .collection('movements')
    .countDocuments({
      assetId,
      type: 'issue',
      effectiveAt: new Date(effectiveAt),
      supersededByCorrectionId: null,
    });
}
