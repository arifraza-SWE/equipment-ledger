import type { Metadata } from 'next';
import { CursorPagination } from '@/components/CursorPagination';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchMovements } from '@/features/movements/api/movements-api';
import { MovementsTable } from '@/features/movements/components/MovementsTable';
import { attemptRequest } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Movements' };

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  // Every cursor walked so far, so that stepping back is a real address and not browser history.
  const trail = Array.isArray(c) ? c : c === undefined ? [] : [c];
  const loaded = await attemptRequest(() =>
    fetchMovements({ cursor: trail[trail.length - 1], limit: PAGE_SIZE }),
  );
  if (!loaded.ok) {
    return (
      <>
        <PageHeader title="Movements" />
        <LoadFailure message={loaded.message} />
      </>
    );
  }
  const { movements, nextCursor } = loaded.value;

  return (
    <>
      <PageHeader
        title="Movements"
        lede="Every entry on the ledger, newest first — issues, returns and service changes across the whole store."
      />
      <MovementsTable movements={movements} caption="Movements across the store" />
      <CursorPagination
        shownCount={movements.length}
        unit="entries"
        newerHref={trail.length > 0 ? movementsHref(trail.slice(0, -1)) : null}
        olderHref={nextCursor === null ? null : movementsHref([...trail, nextCursor])}
      />
    </>
  );
}

function movementsHref(trail: readonly string[]): string {
  const query = new URLSearchParams();
  for (const cursor of trail) {
    query.append('c', cursor);
  }
  const search = query.toString();
  return search ? `/movements?${search}` : '/movements';
}
