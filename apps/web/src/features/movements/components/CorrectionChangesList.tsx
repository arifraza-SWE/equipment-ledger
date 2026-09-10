import type { CorrectableField, CorrectionChange } from '@equipment-ledger/shared';
import { formatInstant } from '@/lib/site-time';
import { workerNameOr, type WorkerNamesById } from '@/features/workers/worker-names';
import styles from './CorrectionChangesList.module.css';

const FIELD_LABELS: Record<CorrectableField, string> = {
  effectiveAt: 'Effective time',
  workerId: 'Worker',
  returnedByWorkerId: 'Returned by',
  dueAt: 'Due back',
  note: 'Note',
};

interface CorrectionChangesListProps {
  changes: CorrectionChange[];
  workerNamesById: WorkerNamesById;
}

export function CorrectionChangesList({ changes, workerNamesById }: CorrectionChangesListProps) {
  return (
    <ul className={styles.changes}>
      {changes.map((change) => (
        <li key={change.field}>
          <span className={styles.field}>{FIELD_LABELS[change.field]}</span>{' '}
          <span className={styles.from}>{describeValue(change.field, change.from, workerNamesById)}</span>
          <span className="muted"> → </span>
          <span className={styles.to}>{describeValue(change.field, change.to, workerNamesById)}</span>
        </li>
      ))}
    </ul>
  );
}

function describeValue(
  field: CorrectableField,
  fieldValue: string | null,
  workerNamesById: WorkerNamesById,
): string {
  if (fieldValue === null) {
    return 'none';
  }
  switch (field) {
    case 'effectiveAt':
    case 'dueAt':
      return formatInstant(fieldValue);
    case 'workerId':
    case 'returnedByWorkerId':
      return workerNameOr(workerNamesById, fieldValue);
    case 'note':
      return fieldValue;
  }
}
