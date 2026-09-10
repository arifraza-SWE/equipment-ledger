import { classNames } from '@/lib/class-names';
import { formatInstant, formatInstantCompact } from '@/lib/site-time';

interface InstantProps {
  iso: string;
  compact?: boolean;
  className?: string;
}

export function Instant({ iso, compact = false, className }: InstantProps) {
  return (
    <time dateTime={iso} className={classNames('mono', className)}>
      {compact ? formatInstantCompact(iso) : formatInstant(iso)}
    </time>
  );
}
