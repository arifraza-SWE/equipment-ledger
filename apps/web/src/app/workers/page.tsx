import type { Metadata } from 'next';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { WorkersTable } from '@/features/workers/components/WorkersTable';
import { attemptRequest } from '@/lib/api-client';

export const metadata: Metadata = { title: 'Workers' };

export default async function WorkersPage() {
  const workers = await attemptRequest(fetchWorkers);

  return (
    <>
      <PageHeader title="Workers" lede="Everyone who can draw equipment, with their certificates." />
      {workers.ok ? <WorkersTable workers={workers.value} /> : <LoadFailure message={workers.message} />}
    </>
  );
}
