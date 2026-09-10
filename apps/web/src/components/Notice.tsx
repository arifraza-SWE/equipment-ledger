import type { ReactNode } from 'react';
import styles from './Notice.module.css';

type NoticeTone = 'error' | 'success' | 'info' | 'warning';

const TONE_CLASS: Record<NoticeTone, string> = {
  error: styles.error,
  success: styles.success,
  info: styles.info,
  warning: styles.warning,
};

interface NoticeProps {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
}

export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${TONE_CLASS[tone]}`} role="status" aria-live="polite">
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
