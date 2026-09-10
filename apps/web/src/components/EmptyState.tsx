import type { ReactNode } from 'react';
import { InboxIcon } from './Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** Swap the default tray for something that fits the screen it appears on. */
  icon?: ReactNode;
}

export function EmptyState({ title, children, icon }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? <InboxIcon size={20} />}
      </span>
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
