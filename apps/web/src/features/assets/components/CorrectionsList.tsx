import type { Correction } from '@equipment-ledger/shared';
import { Instant } from '@/components/Instant';
import { CorrectionChangesList } from '@/features/movements/components/CorrectionChangesList';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import styles from './AssetHistory.module.css';

interface CorrectionsListProps {
  corrections: Correction[];
  workerNamesById: WorkerNamesById;
  keeperNamesById: Readonly<Record<string, string>>;
}

export function CorrectionsList({
  corrections,
  workerNamesById,
  keeperNamesById,
}: CorrectionsListProps) {
  return (
    <section className={styles.corrections} aria-labelledby="corrections-heading">
      <h2 id="corrections-heading" className="section-label">
        Corrections
      </h2>
      <ol className={styles.correctionList}>
        {corrections.map((correction) => (
          <li
            key={correction.correctionId}
            id={`correction-${correction.correctionId}`}
            className={styles.correction}
          >
            <div className={styles.correctionHead}>
              <span className={styles.correctionKind}>
                {correction.kind === 'void' ? 'Voided' : 'Amended'}
              </span>
              <span className="muted">
                by {keeperNamesById[correction.keeperId] ?? correction.keeperId} at{' '}
                <Instant iso={correction.recordedAt} />
              </span>
            </div>
            <p className={styles.correctionReason}>{correction.reason}</p>
            {correction.changes.length > 0 && (
              <CorrectionChangesList
                changes={correction.changes}
                workerNamesById={workerNamesById}
              />
            )}
            <p className={styles.correctionLinks}>
              <a href={`#movement-${correction.originalMovementId}`}>Original entry</a>
              {correction.replacementMovementId && (
                <a href={`#movement-${correction.replacementMovementId}`}>Replacement entry</a>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
