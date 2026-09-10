import { ASSET_KIND_LABELS, type AssetSnapshot, type Reservation } from '@equipment-ledger/shared';
import Link from 'next/link';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { Instant } from '@/components/Instant';
import { StatusBadge } from '@/components/StatusBadge';
import { formatWindow } from '@/lib/site-time';
import { workerNameOr, type WorkerNamesById } from '@/features/workers/worker-names';
import styles from './AssetLedgerTable.module.css';

interface AssetLedgerRowProps {
  snapshot: AssetSnapshot;
  workerNamesById: WorkerNamesById;
  showActions: boolean;
}

export function AssetLedgerRow({ snapshot, workerNamesById, showActions }: AssetLedgerRowProps) {
  const { asset, holding } = snapshot;
  const historyHref = `/assets/${encodeURIComponent(asset.assetId)}`;
  const issuable = holding === null && snapshot.serviceStatus === 'in_service';

  return (
    <tr className={snapshot.overdue ? styles.overdueRow : undefined}>
      <th scope="row">
        <Link href={historyHref} className="mono">
          {asset.assetId}
        </Link>
      </th>
      <td>{ASSET_KIND_LABELS[asset.kind]}</td>
      <td data-wrap="true">{asset.description}</td>
      <td>
        <span className={styles.statusCell}>
          <AssetStatusBadge status={snapshot.status} />
          {holding && snapshot.serviceStatus === 'out_of_service' && (
            <StatusBadge tone="out_of_service">Out of service</StatusBadge>
          )}
        </span>
      </td>
      <td>
        {holding ? (
          <Link href={`/workers/${encodeURIComponent(holding.worker.workerId)}`}>
            {holding.worker.fullName}
          </Link>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td>
        {holding ? <Instant iso={holding.effectiveAt} compact /> : <span className="muted">–</span>}
      </td>
      <td className={snapshot.overdue ? styles.overdueDue : undefined}>
        {holding?.dueAt ? (
          <>
            <Instant iso={holding.dueAt} compact />
            {snapshot.overdue && <span className={styles.overdueFlag}> overdue</span>}
          </>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td>{describeReservation(snapshot, workerNamesById)}</td>
      {showActions && (
        <td className={styles.actionsCell}>
          {issuable && <Link href={`/issue?assetId=${encodeURIComponent(asset.assetId)}`}>Issue</Link>}
          {holding && <Link href={`/return?assetId=${encodeURIComponent(asset.assetId)}`}>Return</Link>}
          <Link href={historyHref}>History</Link>
        </td>
      )}
    </tr>
  );
}

function describeReservation(snapshot: AssetSnapshot, workerNamesById: WorkerNamesById) {
  const reservation = snapshot.currentReservation ?? snapshot.nextReservation;
  if (!reservation) {
    return <span className="muted">–</span>;
  }
  const prefix = snapshot.currentReservation ? 'Now' : 'Next';
  return (
    <span className={styles.reservationCell}>
      <span className="muted">{prefix}</span> {reservationWindowText(reservation)}{' '}
      <span className="muted">for</span> {workerNameOr(workerNamesById, reservation.workerId)}
    </span>
  );
}

function reservationWindowText(reservation: Reservation): string {
  return formatWindow(reservation.startsAt, reservation.endsAt);
}
