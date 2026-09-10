import { Instant } from './Instant';
import styles from './TimestampPair.module.css';

interface TimestampPairProps {
  effectiveAt: string;
  recordedAt: string;
  effectiveLabel?: string;
  layout?: 'inline' | 'stacked';
}

export function TimestampPair({
  effectiveAt,
  recordedAt,
  effectiveLabel = 'Effective',
  layout = 'inline',
}: TimestampPairProps) {
  return (
    <dl className={layout === 'stacked' ? styles.stacked : styles.inline}>
      <div className={styles.entry}>
        <dt>{effectiveLabel}</dt>
        <dd>
          <Instant iso={effectiveAt} />
        </dd>
      </div>
      <div className={styles.entry}>
        <dt>Written down</dt>
        <dd>
          <Instant iso={recordedAt} />
        </dd>
      </div>
    </dl>
  );
}
