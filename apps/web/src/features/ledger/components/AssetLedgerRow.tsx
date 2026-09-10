import { ASSET_KIND_LABELS, type AssetSnapshot } from '@equipment-ledger/shared';
import Link from 'next/link';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  HistoryIcon,
  UserIcon,
} from '@/components/Icon';
import { Instant } from '@/components/Instant';
import { StatusBadge } from '@/components/StatusBadge';
import { classNames } from '@/lib/class-names';
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
          <Link
            href={`/workers/${encodeURIComponent(holding.worker.workerId)}`}
            className={styles.holder}
          >
            <UserIcon size={14} />
            {holding.worker.fullName}
          </Link>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td>
        {holding ? <Instant iso={holding.effectiveAt} compact /> : <span className="muted">–</span>}
      </td>
      <td
        data-wrap="narrow"
        className={classNames(styles.dueColumn, snapshot.overdue && styles.overdueDue)}
      >
        {holding?.dueAt ? (
          <>
            <Instant iso={holding.dueAt} compact />
            {snapshot.overdue && <span className={styles.overdueFlag}>overdue</span>}
          </>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td data-wrap="narrow" className={styles.reservationColumn}>
        {describeReservation(snapshot, workerNamesById)}
      </td>
      {showActions && (
        <td className={styles.actionsCell}>
          <span className={styles.actions}>
            {issuable && (
              <Link
                href={`/issue?assetId=${encodeURIComponent(asset.assetId)}`}
                className={styles.action}
                title={`Issue ${asset.assetId}`}
              >
                <ArrowUpRightIcon size={14} />
                Issue
              </Link>
            )}
            {holding && (
              <Link
                href={`/return?assetId=${encodeURIComponent(asset.assetId)}`}
                className={styles.action}
                title={`Return ${asset.assetId}`}
              >
                <ArrowDownLeftIcon size={14} />
                Return
              </Link>
            )}
            <Link
              href={historyHref}
              className={classNames(styles.action, styles.actionIconOnly)}
              title={`History of ${asset.assetId}`}
              aria-label={`History of ${asset.assetId}`}
            >
              <HistoryIcon size={14} />
            </Link>
          </span>
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
    <span className={styles.reservation}>
      <CalendarIcon size={14} className={styles.reservationIcon} />
      <span className={styles.reservationBody}>
        <span className={styles.reservationWhen}>
          {prefix} {formatWindow(reservation.startsAt, reservation.endsAt)}
        </span>
        <span className={styles.reservationWho}>
          for {workerNameOr(workerNamesById, reservation.workerId)}
        </span>
      </span>
    </span>
  );
}
