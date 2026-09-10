import type { ReactNode } from 'react';
import { classNames } from '@/lib/class-names';
import styles from './StatusBadge.module.css';

export type BadgeTone = 'in_store' | 'reserved' | 'issued' | 'overdue' | 'out_of_service' | 'neutral';

const TONE_CLASS = {
  in_store: styles.inStore,
  reserved: styles.reserved,
  issued: styles.issued,
  overdue: styles.overdue,
  out_of_service: styles.outOfService,
  neutral: styles.neutral,
} satisfies Record<BadgeTone, string | undefined>;

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={classNames(styles.badge, TONE_CLASS[tone])}>{children}</span>;
}
