import { ASSET_KIND_LABELS, CERTIFICATION_LABELS } from '@equipment-ledger/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LoadFailure } from '@/components/LoadFailure';
import { PageHeader } from '@/components/PageHeader';
import { fetchAssetHistory } from '@/features/assets/api/assets-api';
import { AssetHistoryTimeline } from '@/features/assets/components/AssetHistoryTimeline';
import { AssetSnapshotPanel } from '@/features/assets/components/AssetSnapshotPanel';
import { ReservationsTable } from '@/features/reservations/components/ReservationsTable';
import { fetchKeepers } from '@/features/workers/api/keepers-api';
import { fetchWorkers } from '@/features/workers/api/workers-api';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { attemptAll } from '@/lib/api-client';
import { parsePageParam } from '@/lib/pagination';

interface AssetHistoryPageProps {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: AssetHistoryPageProps): Promise<Metadata> {
  const { assetId } = await params;
  return { title: assetId };
}

export default async function AssetHistoryPage({ params, searchParams }: AssetHistoryPageProps) {
  const { assetId } = await params;
  const { page } = await searchParams;
  const loaded = await attemptAll([
    () => fetchAssetHistory(assetId),
    () => fetchWorkers(),
    () => fetchKeepers(),
  ]);
  if (!loaded.ok) {
    if (loaded.notFound) {
      notFound();
    }
    return (
      <>
        <PageHeader title={assetId} />
        <LoadFailure message={loaded.message} />
      </>
    );
  }
  const [history, workers, keepers] = loaded.value;
  const { asset, snapshot } = history;
  const workerNamesById = indexWorkerNames(workers);
  const keeperNamesById = Object.fromEntries(
    keepers.map((keeper) => [keeper.keeperId, keeper.fullName]),
  );
  const issuable = snapshot.holding === null && snapshot.serviceStatus === 'in_service';

  return (
    <div className="stack">
      <PageHeader
        eyebrow={ASSET_KIND_LABELS[asset.kind]}
        title={asset.assetId}
        lede={
          asset.requiredCertification
            ? `${asset.description} · needs ${CERTIFICATION_LABELS[asset.requiredCertification]}`
            : asset.description
        }
        actions={
          <>
            {issuable && (
              <Link href={`/issue?assetId=${encodeURIComponent(asset.assetId)}`}>Issue</Link>
            )}
            {snapshot.holding && (
              <Link href={`/return?assetId=${encodeURIComponent(asset.assetId)}`}>Return</Link>
            )}
          </>
        }
      />
      <AssetSnapshotPanel snapshot={snapshot} workerNamesById={workerNamesById} />
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="section-label">
          Ledger, in the order things happened
        </h2>
        <AssetHistoryTimeline
          movements={history.movements}
          corrections={history.corrections}
          workers={workers}
          workerNamesById={workerNamesById}
          keeperNamesById={keeperNamesById}
          page={parsePageParam(page)}
          hrefForPage={(target) => assetHistoryHref(asset.assetId, target)}
        />
      </section>
      <section aria-labelledby="asset-reservations-heading">
        <h2 id="asset-reservations-heading" className="section-label">
          Reservations
        </h2>
        <ReservationsTable
          reservations={history.reservations}
          workerNamesById={workerNamesById}
          showAsset={false}
          emptyTitle="No reservations for this asset"
        />
      </section>
    </div>
  );
}

function assetHistoryHref(assetId: string, page: number): string {
  const path = `/assets/${encodeURIComponent(assetId)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}
