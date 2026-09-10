'use client';

import type { AssetSnapshot } from '@equipment-ledger/shared';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { PaginationControls } from '@/components/PaginationControls';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import { usePagedList } from '@/hooks/use-paged-list';
import { useAssetFilters } from '../hooks/use-asset-filters';
import { AssetLedgerFilters } from './AssetLedgerFilters';
import { AssetLedgerRow } from './AssetLedgerRow';

interface AssetLedgerTableProps {
  assets: AssetSnapshot[];
  workerNamesById: WorkerNamesById;
  mode: 'live' | 'historical';
}

export function AssetLedgerTable({ assets, workerNamesById, mode }: AssetLedgerTableProps) {
  const controls = useAssetFilters(assets);
  const paged = usePagedList(controls.filteredAssets);
  const showActions = mode === 'live';

  return (
    <div>
      <AssetLedgerFilters controls={controls} totalCount={assets.length} />
      {controls.filteredAssets.length === 0 ? (
        <EmptyState title="No assets match these filters">
          Clear the search or widen the status and kind filters.
        </EmptyState>
      ) : (
        <DataTable caption="Assets in the store" stickyHeader pinFirstColumn>
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Kind</th>
              <th scope="col" data-wrap="true">
                Description
              </th>
              <th scope="col">Status</th>
              <th scope="col">Held by</th>
              <th scope="col">Out since</th>
              <th scope="col">Due back</th>
              <th scope="col">Reservation</th>
              {showActions && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paged.items.map((snapshot) => (
              <AssetLedgerRow
                key={snapshot.asset.assetId}
                snapshot={snapshot}
                workerNamesById={workerNamesById}
                showActions={showActions}
              />
            ))}
          </tbody>
        </DataTable>
      )}
      <PaginationControls
        page={paged.page}
        pageCount={paged.pageCount}
        totalCount={paged.totalCount}
        rangeStart={paged.rangeStart}
        rangeEnd={paged.rangeEnd}
        unit="assets"
        onPageChange={paged.setPage}
      />
    </div>
  );
}
