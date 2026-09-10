import type { Connection } from 'mongoose';
import type { MovementRecord } from '../../src/modules/ledger/persistence/movement.schema';

export interface NaiveAssetState {
  holderWorkerId: string | null;
  outOfService: boolean;
}

/**
 * A second, deliberately simple implementation of "what does the ledger say at instant T",
 * written against raw documents so the invariant tests do not trust the code under test.
 */
export function naiveStateAt(
  movements: readonly MovementRecord[],
  instant: Date,
): Map<string, NaiveAssetState> {
  const relevant = movements
    .filter(
      (movement) =>
        movement.supersededByCorrectionId === null &&
        movement.effectiveAt.getTime() <= instant.getTime(),
    )
    .sort(
      (left, right) =>
        left.effectiveAt.getTime() - right.effectiveAt.getTime() || left.sequence - right.sequence,
    );

  const states = new Map<string, NaiveAssetState>();
  for (const movement of relevant) {
    const state = states.get(movement.assetId) ?? { holderWorkerId: null, outOfService: false };
    if (movement.type === 'issue') {
      state.holderWorkerId = movement.workerId;
    } else if (movement.type === 'return') {
      state.holderWorkerId = null;
    } else if (movement.type === 'out_of_service') {
      state.outOfService = true;
    } else {
      state.outOfService = false;
    }
    states.set(movement.assetId, state);
  }
  return states;
}

export async function readAllMovements(connection: Connection): Promise<MovementRecord[]> {
  return connection.collection<MovementRecord>('movements').find({}).toArray();
}
