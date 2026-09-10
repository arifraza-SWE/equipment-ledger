import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { fetchStoreSnapshot } from '@/features/ledger/api/ledger-api';
import { AsOfLedgerView } from '@/features/ledger/components/AsOfLedgerView';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { attemptRequest } from '@/lib/api-client';

export const metadata: Metadata = { title: 'As of' };

export default async function AsOfPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;
  const requestedAt = at?.trim() ? at.trim() : null;
  const [snapshot, workers] = await Promise.all([
    attemptRequest(() => fetchStoreSnapshot(requestedAt ?? undefined)),
    attemptRequest(fetchWorkers),
  ]);

  return (
    <>
      <PageHeader
        title="The store as of an instant"
        lede="Rebuilt from the ledger for any moment since the store opened. The address of this page carries the instant, so it can be shared."
      />
      <AsOfLedgerView
        requestedAt={requestedAt}
        snapshot={snapshot.ok ? snapshot.value : null}
        failureMessage={snapshot.ok ? null : snapshot.message}
        workerNamesById={indexWorkerNames(workers.ok ? workers.value : [])}
      />
    </>
  );
}
