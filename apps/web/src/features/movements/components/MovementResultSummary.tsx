import { MOVEMENT_TYPE_LABELS, type MovementResult } from '@equipment-ledger/shared';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { Instant } from '@/components/Instant';
import { Notice } from '@/components/Notice';
import { TimestampPair } from '@/components/TimestampPair';
import formStyles from '@/components/Form.module.css';
import { VoidedReservationsList } from '@/features/reservations/components/VoidedReservationsList';
import type { WorkerNamesById } from '@/features/workers/worker-names';

interface MovementResultSummaryProps {
  result: MovementResult;
  replayed: boolean;
  workerNamesById: WorkerNamesById;
}

export function MovementResultSummary({
  result,
  replayed,
  workerNamesById,
}: MovementResultSummaryProps) {
  const { movement, asset, serviceStatusChange, voidedReservations } = result;

  return (
    <Notice tone="success" title={`${MOVEMENT_TYPE_LABELS[movement.type]} · ${movement.assetId}`}>
      <dl className={formStyles.summary}>
        {replayed && (
          <div>
            <dt>Already recorded</dt>
            <dd>This entry was written on an earlier attempt; the ledger holds it once.</dd>
          </div>
        )}
        <div>
          <dt>Times</dt>
          <dd>
            <TimestampPair effectiveAt={movement.effectiveAt} recordedAt={movement.recordedAt} />
          </dd>
        </div>
        <div>
          <dt>Asset now</dt>
          <dd>
            <AssetStatusBadge status={asset.status} />
            {asset.holding && (
              <span>
                {' '}
                held by {asset.holding.worker.fullName}
                {asset.holding.dueAt && (
                  <>
                    , due back <Instant iso={asset.holding.dueAt} />
                  </>
                )}
              </span>
            )}
          </dd>
        </div>
        {serviceStatusChange && (
          <div>
            <dt>{MOVEMENT_TYPE_LABELS[serviceStatusChange.type]}</dt>
            <dd>
              <TimestampPair
                effectiveAt={serviceStatusChange.effectiveAt}
                recordedAt={serviceStatusChange.recordedAt}
              />
              {serviceStatusChange.note && <p>Reason: {serviceStatusChange.note}</p>}
            </dd>
          </div>
        )}
        {(serviceStatusChange || voidedReservations.length > 0) && (
          <div>
            <dt>Voided reservations</dt>
            <dd>
              <VoidedReservationsList
                reservations={voidedReservations}
                workerNamesById={workerNamesById}
              />
            </dd>
          </div>
        )}
      </dl>
    </Notice>
  );
}
