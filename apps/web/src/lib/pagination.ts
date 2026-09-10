export const PAGE_SIZE = 25;

export interface PagedSlice<TItem> {
  items: TItem[];
  page: number;
  pageCount: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
}

/**
 * Slices an already-loaded list. The requested page is clamped rather than rejected, so a stale
 * `?page=` in a bookmark lands on the last page instead of an empty screen.
 */
export function paginate<TItem>(
  items: readonly TItem[],
  requestedPage: number,
  pageSize: number = PAGE_SIZE,
): PagedSlice<TItem> {
  const totalCount = items.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(Math.trunc(requestedPage), 1), pageCount);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    totalCount,
    rangeStart: totalCount === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, totalCount),
  };
}

export function parsePageParam(candidate: string | undefined): number {
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** The run of page numbers to offer around the current one, so long lists don't grow a long bar. */
export function pageWindow(page: number, pageCount: number, span = 5): number[] {
  const first = Math.max(1, Math.min(page - Math.floor(span / 2), pageCount - span + 1));
  const last = Math.min(pageCount, first + span - 1);
  const numbers: number[] = [];
  for (let number = first; number <= last; number += 1) {
    numbers.push(number);
  }
  return numbers;
}
