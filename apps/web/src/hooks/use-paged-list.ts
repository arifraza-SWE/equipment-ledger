'use client';

import { useRef, useState } from 'react';
import { PAGE_SIZE, paginate, type PagedSlice } from '@/lib/pagination';

export interface PagedList<TItem> extends PagedSlice<TItem> {
  setPage: (page: number) => void;
}

/**
 * Pages a list the browser already holds. When the list itself changes — a filter narrowed it —
 * the reader is put back on the first page, because page four of the old list means nothing in
 * the new one.
 */
export function usePagedList<TItem>(
  items: readonly TItem[],
  pageSize: number = PAGE_SIZE,
): PagedList<TItem> {
  const [page, setPage] = useState(1);
  const listOnLastRender = useRef(items);

  if (listOnLastRender.current !== items) {
    listOnLastRender.current = items;
    if (page !== 1) {
      setPage(1);
    }
  }

  return { ...paginate(items, page, pageSize), setPage };
}
