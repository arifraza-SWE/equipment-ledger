import Link from 'next/link';
import { Instant } from '@/components/Instant';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchStoreSnapshot } from '@/features/ledger/api/ledger-api';
import { AssetLedgerTable } from '@/features/ledger/components/AssetLedgerTable';
import { StoreTotalsStrip } from '@/features/ledger/components/StoreTotalsStrip';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { attemptAll } from '@/lib/api-client';

export default async function DashboardPage() {
  const loaded = await attemptAll([() => fetchStoreSnapshot(), () => fetchWorkers()]);
  if (!loaded.ok) {
    return (
      <>
        <PageHeader title="Store ledger" />
        <LoadFailure message={loaded.message} />
      </>
    );
  }
  const [snapshot, workers] = loaded.value;

  return (
    <>
      <PageHeader
        title="Store ledger"
        lede={
          <>
            Every asset as it stands at <Instant iso={snapshot.asOf} />.
          </>
        }
        actions={<Link href="/as-of">Look at an earlier instant</Link>}
      />
      <StoreTotalsStrip totals={snapshot.totals} />
      <AssetLedgerTable
        assets={snapshot.assets}
        workerNamesById={indexWorkerNames(workers)}
        mode="live"
      />
    </>
  );
}
