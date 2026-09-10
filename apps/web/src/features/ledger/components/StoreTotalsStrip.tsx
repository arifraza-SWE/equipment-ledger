import type { StoreSnapshotTotals } from '@equipment-ledger/shared';
import styles from './StoreTotalsStrip.module.css';

const TOTAL_LABELS: ReadonlyArray<{ key: keyof StoreSnapshotTotals; label: string }> = [
  { key: 'assets', label: 'assets' },
  { key: 'inStore', label: 'in store' },
  { key: 'issued', label: 'issued' },
  { key: 'overdue', label: 'overdue' },
  { key: 'reserved', label: 'reserved' },
  { key: 'outOfService', label: 'out of service' },
];

export function StoreTotalsStrip({ totals }: { totals: StoreSnapshotTotals }) {
  return (
    <dl className={styles.strip} aria-label="Store totals">
      {TOTAL_LABELS.map(({ key, label }) => (
        <div key={key} className={styles.total} data-flagged={key === 'overdue' && totals[key] > 0}>
          <dd className={styles.count}>{totals[key]}</dd>
          <dt className={styles.label}>{label}</dt>
        </div>
      ))}
    </dl>
  );
}
