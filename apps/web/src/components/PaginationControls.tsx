'use client';

import { pageWindow } from '@/lib/pagination';
import styles from './Pagination.module.css';

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  unit: string;
  onPageChange: (page: number) => void;
}

/**
 * Paging for lists the browser already holds and filters. Nothing is fetched when the page turns,
 * so these are buttons rather than links: there is no new address to go to.
 */
export function PaginationControls({
  page,
  pageCount,
  totalCount,
  rangeStart,
  rangeEnd,
  unit,
  onPageChange,
}: PaginationControlsProps) {
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
          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous"
          >
            ‹ Prev
          </button>
          {firstOffered > 1 && <span className={styles.gap}>…</span>}
          {numbers.map((number) => (
            <button
              key={number}
              type="button"
              className={styles.page}
              onClick={() => onPageChange(number)}
              aria-current={number === page ? 'page' : undefined}
              aria-label={`Page ${number}`}
            >
              {number}
            </button>
          ))}
          {lastOffered < pageCount && <span className={styles.gap}>…</span>}
          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Next"
          >
            Next ›
          </button>
        </nav>
      )}
    </div>
  );
}
