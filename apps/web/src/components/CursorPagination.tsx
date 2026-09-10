import Link from 'next/link';
import styles from './Pagination.module.css';

interface CursorPaginationProps {
  shownCount: number;
  unit: string;
  newerHref: string | null;
  olderHref: string | null;
}

/**
 * Paging for an append-only log. A cursor names a position, not an offset, so there is no page
 * count to show and no way to jump to page seven — only the step either side of where you are.
 * The trade is that a page cannot skip or repeat an entry while movements are being written.
 */
export function CursorPagination({
  shownCount,
  unit,
  newerHref,
  olderHref,
}: CursorPaginationProps) {
  if (shownCount === 0) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <p className={styles.summary}>
        Showing <span className={styles.count}>{shownCount}</span> {unit}
      </p>
      <nav className={styles.pages} aria-label="Pagination">
        <Step href={newerHref} text="‹ Newer" label="Newer movements" />
        <Step href={olderHref} text="Older ›" label="Older movements" />
      </nav>
    </div>
  );
}

function Step({ href, text, label }: { href: string | null; text: string; label: string }) {
  if (href === null) {
    return (
      <span className={styles.step} aria-disabled="true">
        {text}
      </span>
    );
  }
  return (
    <Link href={href} className={styles.step} aria-label={label}>
      {text}
    </Link>
  );
}
