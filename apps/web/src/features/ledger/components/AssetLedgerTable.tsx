'use client';

import type { AssetSnapshot } from '@equipment-ledger/shared';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import type { WorkerNamesById } from '@/features/workers/worker-names';
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
  const showActions = mode === 'live';

  return (
    <div>
      <AssetLedgerFilters controls={controls} totalCount={assets.length} />
      {controls.filteredAssets.length === 0 ? (
        <EmptyState title="No assets match these filters">
          Clear the search or widen the status and kind filters.
        </EmptyState>
      ) : (
        <DataTable caption="Assets in the store" stickyHeader>
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
            {controls.filteredAssets.map((snapshot) => (
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
    </div>
  );
}
