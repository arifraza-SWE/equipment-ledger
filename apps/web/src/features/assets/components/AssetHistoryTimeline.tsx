import type { Correction, MovementWithNames, Worker } from '@equipment-ledger/shared';
import { EmptyState } from '@/components/EmptyState';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import { AssetTimelineEntry } from './AssetTimelineEntry';
import { CorrectionsList } from './CorrectionsList';
import styles from './AssetHistory.module.css';

interface AssetHistoryTimelineProps {
  movements: MovementWithNames[];
  corrections: Correction[];
  workers: Worker[];
  workerNamesById: WorkerNamesById;
  keeperNamesById: Readonly<Record<string, string>>;
}

export function AssetHistoryTimeline({
  movements,
  corrections,
  workers,
  workerNamesById,
  keeperNamesById,
}: AssetHistoryTimelineProps) {
  const correctionsById = new Map(
    corrections.map((correction) => [correction.correctionId, correction]),
  );
  const ordered = [...movements].sort(compareByEffectiveTime);

  if (ordered.length === 0) {
    return <EmptyState title="Nothing on the ledger for this asset yet" />;
  }

  return (
    <div className={styles.timelineWrap}>
      <ol className={styles.timeline}>
        {ordered.map((entry) => (
          <AssetTimelineEntry
            key={entry.movement.movementId}
            entry={entry}
            supersededBy={lookup(correctionsById, entry.movement.supersededByCorrectionId)}
            createdBy={lookup(correctionsById, entry.movement.createdByCorrectionId)}
            workers={workers}
          />
        ))}
      </ol>
      {corrections.length > 0 && (
        <CorrectionsList
          corrections={corrections}
          workerNamesById={workerNamesById}
          keeperNamesById={keeperNamesById}
        />
      )}
    </div>
  );
}

function compareByEffectiveTime(left: MovementWithNames, right: MovementWithNames): number {
  return (
    left.movement.effectiveAt.localeCompare(right.movement.effectiveAt) ||
    left.movement.recordedAt.localeCompare(right.movement.recordedAt)
  );
}

function lookup(
  correctionsById: ReadonlyMap<string, Correction>,
  correctionId: string | null,
): Correction | null {
  return correctionId ? (correctionsById.get(correctionId) ?? null) : null;
}
