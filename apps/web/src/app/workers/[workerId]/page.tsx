import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { MovementsTable } from '@/features/movements/components/MovementsTable';
import { ReservationsTable } from '@/features/reservations/components/ReservationsTable';
import { fetchWorkerDetail } from '@/features/workers/api/workers-api';
import { HoldingsTable } from '@/features/workers/components/HoldingsTable';
import { WorkerCertificationsTable } from '@/features/workers/components/WorkerCertificationsTable';
import { attemptRequest } from '@/lib/api-client';

interface WorkerPageProps {
  params: Promise<{ workerId: string }>;
}

export async function generateMetadata({ params }: WorkerPageProps): Promise<Metadata> {
  const { workerId } = await params;
  return { title: workerId };
}

export default async function WorkerPage({ params }: WorkerPageProps) {
  const { workerId } = await params;
  const detail = await attemptRequest(() => fetchWorkerDetail(workerId));
  if (!detail.ok) {
    if (detail.notFound) {
      notFound();
    }
    return (
      <>
        <PageHeader title={workerId} />
        <LoadFailure message={detail.message} />
      </>
    );
  }
  const { worker, holdings, recentMovements, reservations } = detail.value;
  const workerNamesById = { [worker.workerId]: worker.fullName };

  return (
    <div className="stack">
      <PageHeader eyebrow={worker.trade} title={worker.fullName} lede={<span className="mono">{worker.workerId}</span>} />
      <section aria-labelledby="certificates-heading">
        <h2 id="certificates-heading" className="section-label">
          Certificates
        </h2>
        <WorkerCertificationsTable certifications={worker.certifications} />
      </section>
      <section aria-labelledby="holdings-heading">
        <h2 id="holdings-heading" className="section-label">
          Holding now
        </h2>
        <HoldingsTable holdings={holdings} />
      </section>
      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="section-label">
          Recent movements
        </h2>
        <MovementsTable movements={recentMovements} caption={`Recent movements for ${worker.fullName}`} />
      </section>
      <section aria-labelledby="worker-reservations-heading">
        <h2 id="worker-reservations-heading" className="section-label">
          Reservations
        </h2>
        <ReservationsTable
          reservations={reservations}
          workerNamesById={workerNamesById}
          emptyTitle="No reservations for this worker"
        />
      </section>
    </div>
  );
}
