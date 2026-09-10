import type { AssetSnapshot } from '@equipment-ledger/shared';
import Link from 'next/link';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Instant } from '@/components/Instant';

export function HoldingsTable({ holdings }: { holdings: AssetSnapshot[] }) {
  if (holdings.length === 0) {
    return <EmptyState title="Holds nothing at the moment" />;
  }

  return (
    <DataTable caption="Current holdings">
      <thead>
        <tr>
          <th scope="col">Asset</th>
          <th scope="col" data-wrap="true">
            Description
          </th>
          <th scope="col">Status</th>
          <th scope="col">Out since</th>
          <th scope="col">Due back</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {holdings.map((snapshot) => (
          <tr key={snapshot.asset.assetId}>
            <th scope="row">
              <Link href={`/assets/${encodeURIComponent(snapshot.asset.assetId)}`} className="mono">
                {snapshot.asset.assetId}
              </Link>
            </th>
            <td data-wrap="true">{snapshot.asset.description}</td>
            <td>
              <AssetStatusBadge status={snapshot.status} />
            </td>
            <td>
              {snapshot.holding ? (
                <Instant iso={snapshot.holding.effectiveAt} />
              ) : (
                <span className="muted">–</span>
              )}
            </td>
            <td>
              {snapshot.holding?.dueAt ? (
                <Instant iso={snapshot.holding.dueAt} />
              ) : (
                <span className="muted">–</span>
              )}
            </td>
            <td>
              <Link href={`/return?assetId=${encodeURIComponent(snapshot.asset.assetId)}`}>
                Return
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
