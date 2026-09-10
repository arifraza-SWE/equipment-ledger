import type { StoreSnapshotTotals } from '@equipment-ledger/shared';
import type { ReactNode } from 'react';
import {
  AlertIcon,
  BookmarkIcon,
  CheckIcon,
  PackageIcon,
  ArrowUpRightIcon,
  WrenchIcon,
} from '@/components/Icon';
import styles from './StoreTotalsStrip.module.css';

interface TotalCard {
  key: keyof StoreSnapshotTotals;
  label: string;
  tone: string;
  icon: ReactNode;
}

const TOTAL_CARDS: readonly TotalCard[] = [
  { key: 'assets', label: 'Assets', tone: 'neutral', icon: <PackageIcon size={15} /> },
  { key: 'inStore', label: 'In store', tone: 'in_store', icon: <CheckIcon size={15} /> },
  { key: 'issued', label: 'Issued', tone: 'issued', icon: <ArrowUpRightIcon size={15} /> },
  { key: 'overdue', label: 'Overdue', tone: 'overdue', icon: <AlertIcon size={15} /> },
  { key: 'reserved', label: 'Reserved', tone: 'reserved', icon: <BookmarkIcon size={15} /> },
  {
    key: 'outOfService',
    label: 'Out of service',
    tone: 'out_of_service',
    icon: <WrenchIcon size={15} />,
  },
];

export function StoreTotalsStrip({ totals }: { totals: StoreSnapshotTotals }) {
  return (
    <dl className={styles.grid} aria-label="Store totals">
      {TOTAL_CARDS.map(({ key, label, tone, icon }) => (
        <div
          key={key}
          className={styles.card}
          data-tone={tone}
          data-flagged={key === 'overdue' && totals[key] > 0}
        >
          <div className={styles.head}>
            <dt className={styles.label}>{label}</dt>
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          </div>
          <dd className={styles.count}>{totals[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
