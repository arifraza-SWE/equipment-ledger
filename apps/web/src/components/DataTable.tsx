import type { ReactNode } from 'react';
import { classNames } from '@/lib/class-names';
import styles from './DataTable.module.css';

interface DataTableProps {
  caption: string;
  children: ReactNode;
  stickyHeader?: boolean;
  /** Keeps the row header in view when a wide table has to scroll sideways. */
  pinFirstColumn?: boolean;
}

export function DataTable({
  caption,
  children,
  stickyHeader = false,
  pinFirstColumn = false,
}: DataTableProps) {
  return (
    <div className={styles.wrap}>
      <table
        className={classNames(
          styles.table,
          stickyHeader && styles.sticky,
          pinFirstColumn && styles.pinFirst,
        )}
      >
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
