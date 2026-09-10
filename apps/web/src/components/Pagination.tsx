import Link from 'next/link';
import { pageWindow } from '@/lib/pagination';
import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  pageCount: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  unit: string;
  hrefForPage: (page: number) => string;
}

/** Paging for server-rendered lists. Pages are links, so each one is bookmarkable. */
export function Pagination({
  page,
  pageCount,
  totalCount,
  rangeStart,
  rangeEnd,
  unit,
  hrefForPage,
}: PaginationProps) {
  if (totalCount === 0) {
    return null;
  }
  const numbers = pageWindow(page, pageCount);
  const firstOffered = numbers[0] ?? 1;
  const lastOffered = numbers[numbers.length - 1] ?? pageCount;

  return (
    <div className={styles.bar}>
      <p className={styles.summary} aria-live="polite">
        Showing <span className={styles.count}>{rangeStart}</span>–
        <span className={styles.count}>{rangeEnd}</span> of{' '}
        <span className={styles.count}>{totalCount}</span> {unit}
      </p>
      {pageCount > 1 && (
        <nav className={styles.pages} aria-label="Pagination">
          <Step href={hrefForPage(page - 1)} disabled={page === 1} label="Previous" text="‹ Prev" />
          {firstOffered > 1 && <span className={styles.gap}>…</span>}
          {numbers.map((number) => (
            <Link
              key={number}
              href={hrefForPage(number)}
              className={styles.page}
              aria-current={number === page ? 'page' : undefined}
              aria-label={`Page ${number}`}
            >
              {number}
            </Link>
          ))}
          {lastOffered < pageCount && <span className={styles.gap}>…</span>}
          <Step
            href={hrefForPage(page + 1)}
            disabled={page === pageCount}
            label="Next"
            text="Next ›"
          />
        </nav>
      )}
    </div>
  );
}

function Step({
  href,
  disabled,
  label,
  text,
}: {
  href: string;
  disabled: boolean;
  label: string;
  text: string;
}) {
  if (disabled) {
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
