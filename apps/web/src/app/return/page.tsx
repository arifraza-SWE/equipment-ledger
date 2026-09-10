import type { Metadata } from 'next';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchAssetSnapshots } from '@/features/ledger/api/ledger-api';
import { ReturnAssetForm } from '@/features/movements/components/ReturnAssetForm';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { attemptAll } from '@/lib/api-client';

export const metadata: Metadata = { title: 'Return' };

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId } = await searchParams;
  const loaded = await attemptAll([() => fetchAssetSnapshots(), () => fetchWorkers()]);

  return (
    <>
      <PageHeader title="Return" lede="Take an asset back at the hatch and close its loan." />
      {loaded.ok ? (
        <ReturnAssetForm
          assets={loaded.value[0]}
          workers={loaded.value[1]}
          initialAssetId={assetId ?? null}
        />
      ) : (
        <LoadFailure message={loaded.message} />
      )}
    </>
  );
}
