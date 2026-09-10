import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

interface DataTableProps {
  caption: string;
  children: ReactNode;
  stickyHeader?: boolean;
}

export function DataTable({ caption, children, stickyHeader = false }: DataTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={stickyHeader ? `${styles.table} ${styles.sticky}` : styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
