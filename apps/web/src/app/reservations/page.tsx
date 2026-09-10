import { RESERVATION_STATUSES, type ReservationStatus } from '@equipment-ledger/shared';
import type { Metadata } from 'next';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { fetchAssetSnapshots } from '@/features/ledger/api/ledger-api';
import { fetchReservations } from '@/features/reservations/api/reservations-api';
import { ReservationForm } from '@/features/reservations/components/ReservationForm';
import { ReservationStatusFilter } from '@/features/reservations/components/ReservationStatusFilter';
import { ReservationsTable } from '@/features/reservations/components/ReservationsTable';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { attemptAll } from '@/lib/api-client';
import { paginate, parsePageParam } from '@/lib/pagination';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Reservations' };

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const statusFilter = parseStatus(status);
  const loaded = await attemptAll([
    () => fetchReservations(statusFilter ? { status: statusFilter } : {}),
    () => fetchAssetSnapshots(),
    () => fetchWorkers(),
  ]);
  if (!loaded.ok) {
    return (
      <>
        <PageHeader title="Reservations" />
        <LoadFailure message={loaded.message} />
      </>
    );
  }
  const [reservations, assets, workers] = loaded.value;
  const paged = paginate(reservations, parsePageParam(page));

  return (
    <>
      <PageHeader title="Reservations" lede="Claims on assets for a future window." />
      <div className={styles.layout}>
        <section className={styles.createPanel} aria-labelledby="new-reservation-heading">
          <h2 id="new-reservation-heading" className={styles.createHeading}>
            New reservation
          </h2>
          <ReservationForm assets={assets} workers={workers} inline />
        </section>

        <section className={styles.listSection} aria-labelledby="reservations-heading">
          <h2 id="reservations-heading" className="visually-hidden">
            Existing reservations
          </h2>
          <ReservationStatusFilter current={statusFilter} />
          <ReservationsTable
            reservations={paged.items}
            workerNamesById={indexWorkerNames(workers)}
            emptyTitle={statusFilter ? `No ${statusFilter} reservations` : 'No reservations'}
          />
          <Pagination
            page={paged.page}
            pageCount={paged.pageCount}
            totalCount={paged.totalCount}
            rangeStart={paged.rangeStart}
            rangeEnd={paged.rangeEnd}
            unit="reservations"
            hrefForPage={(target) => reservationsHref(statusFilter, target)}
          />
        </section>
      </div>
    </>
  );
}

function parseStatus(candidate: string | undefined): ReservationStatus | null {
  return RESERVATION_STATUSES.find((status) => status === candidate) ?? null;
}

function reservationsHref(status: ReservationStatus | null, page: number): string {
  const query = new URLSearchParams();
  if (status) {
    query.set('status', status);
  }
  if (page > 1) {
    query.set('page', String(page));
  }
  const search = query.toString();
  return search ? `/reservations?${search}` : '/reservations';
}
