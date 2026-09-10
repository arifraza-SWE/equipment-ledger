import type { MovementWithNames } from '@equipment-ledger/shared';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Instant } from '@/components/Instant';
import { MovementTypeBadge } from '@/components/MovementTypeBadge';

interface MovementsTableProps {
  movements: MovementWithNames[];
  caption: string;
}

export function MovementsTable({ movements, caption }: MovementsTableProps) {
  if (movements.length === 0) {
    return <EmptyState title="No movements yet" />;
  }

  return (
    <DataTable caption={caption}>
      <thead>
        <tr>
          <th scope="col">Entry</th>
          <th scope="col">Asset</th>
          <th scope="col">Worker</th>
          <th scope="col">Effective</th>
          <th scope="col">Written down</th>
          <th scope="col">Keeper</th>
          <th scope="col" data-wrap="true">
            Note
          </th>
        </tr>
      </thead>
      <tbody>
        {movements.map(({ movement, worker, returnedBy, keeper }) => (
          <tr key={movement.movementId} data-superseded={movement.supersededByCorrectionId !== null}>
            <td>
              <MovementTypeBadge type={movement.type} />
              {movement.supersededByCorrectionId && <span className="muted"> corrected</span>}
            </td>
            <td>
              <Link href={`/assets/${encodeURIComponent(movement.assetId)}`} className="mono">
                {movement.assetId}
              </Link>
            </td>
            <td>
              {worker ? worker.fullName : <span className="muted">–</span>}
              {returnedBy && returnedBy.workerId !== worker?.workerId && (
                <span className="muted"> · handed back by {returnedBy.fullName}</span>
              )}
            </td>
            <td>
              <Instant iso={movement.effectiveAt} />
            </td>
            <td>
              <Instant iso={movement.recordedAt} />
            </td>
            <td>{keeper.fullName}</td>
            <td data-wrap="true">{movement.note ?? <span className="muted">–</span>}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
