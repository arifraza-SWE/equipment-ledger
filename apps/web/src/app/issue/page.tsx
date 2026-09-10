import type { Metadata } from 'next';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchAssetSnapshots } from '@/features/ledger/api/ledger-api';
import { IssueAssetForm } from '@/features/movements/components/IssueAssetForm';
import { fetchReservations } from '@/features/reservations/api/reservations-api';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { attemptAll } from '@/lib/api-client';

export const metadata: Metadata = { title: 'Issue' };

export default async function IssuePage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId } = await searchParams;
  const loaded = await attemptAll([
    () => fetchAssetSnapshots(),
    () => fetchWorkers(),
    () => fetchReservations({ status: 'active' }),
  ]);

  return (
    <>
      <PageHeader title="Issue" lede="Hand an asset to a worker and write it on the ledger." />
      {loaded.ok ? (
        <IssueAssetForm
          assets={loaded.value[0]}
          workers={loaded.value[1]}
          activeReservations={loaded.value[2]}
          initialAssetId={assetId ?? null}
        />
      ) : (
        <LoadFailure message={loaded.message} />
      )}
    </>
  );
}
