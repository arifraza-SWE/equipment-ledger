import { formatInstant } from '@/lib/format-instant';

export function Instant({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={className ? `mono ${className}` : 'mono'}>
      {formatInstant(iso)}
    </time>
  );
}
