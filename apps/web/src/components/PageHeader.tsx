import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  lede?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, lede, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        {eyebrow && <p className="section-label">{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
