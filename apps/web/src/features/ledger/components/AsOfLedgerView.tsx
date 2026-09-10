import type { StoreSnapshot } from '@equipment-ledger/shared';
import { EmptyState } from '@/components/EmptyState';
import { Instant } from '@/components/Instant';
import { Notice } from '@/components/Notice';
import { formatInstant } from '@/lib/site-time';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import { AsOfInstantPicker } from './AsOfInstantPicker';
import { AssetLedgerTable } from './AssetLedgerTable';
import { StoreTotalsStrip } from './StoreTotalsStrip';
import styles from './AsOfLedgerView.module.css';

interface AsOfLedgerViewProps {
  requestedAt: string | null;
  snapshot: StoreSnapshot | null;
  failureMessage: string | null;
  workerNamesById: WorkerNamesById;
}

export function AsOfLedgerView({
  requestedAt,
  snapshot,
  failureMessage,
  workerNamesById,
}: AsOfLedgerViewProps) {
  return (
    <div className={styles.view}>
      <AsOfInstantPicker initialAt={requestedAt} />
      {failureMessage && (
        <Notice tone="error" title="That instant could not be shown">
          {failureMessage}
        </Notice>
      )}
      {snapshot && <SnapshotAtInstant snapshot={snapshot} workerNamesById={workerNamesById} />}
    </div>
  );
}

function SnapshotAtInstant({
  snapshot,
  workerNamesById,
}: {
  snapshot: StoreSnapshot;
  workerNamesById: WorkerNamesById;
}) {
  const beforeOpening =
    snapshot.storeOpenedAt !== null && snapshot.asOf < snapshot.storeOpenedAt;

  return (
    <>
      <p className={styles.echo}>
        Store as it stood at <Instant iso={snapshot.asOf} />{' '}
        <span className={`mono ${styles.echoIso}`}>{snapshot.asOf}</span>
      </p>
      {beforeOpening && snapshot.storeOpenedAt ? (
        <EmptyState title={`The store did not exist yet on ${formatInstant(snapshot.asOf)}`}>
          It opened on <Instant iso={snapshot.storeOpenedAt} />. Pick a later instant.
        </EmptyState>
      ) : (
        <>
          <StoreTotalsStrip totals={snapshot.totals} />
          <AssetLedgerTable
            assets={snapshot.assets}
            workerNamesById={workerNamesById}
            mode="historical"
          />
        </>
      )}
    </>
  );
}
