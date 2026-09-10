'use client';

import type {
  ChangeServiceStatusRequest,
  ServiceStatus,
  ServiceStatusChangeResult,
} from '@equipment-ledger/shared';
import { useState, type FormEvent } from 'react';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { DatetimeField } from '@/components/DatetimeField';
import { useSelectedKeeper } from '@/components/KeeperProvider';
import { NoteField } from '@/components/NoteField';
import { Notice } from '@/components/Notice';
import { SubmissionFeedback } from '@/components/SubmissionFeedback';
import { SubmitBar } from '@/components/SubmitBar';
import { TimestampPair } from '@/components/TimestampPair';
import formStyles from '@/components/Form.module.css';
import { VoidedReservationsList } from '@/features/reservations/components/VoidedReservationsList';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import { useLedgerSubmission } from '@/hooks/use-ledger-submission';
import { isoFromSiteWallClock, siteWallClockNow } from '@/lib/site-time';
import { changeServiceStatus } from '../api/movements-api';

interface ServiceStatusFormProps {
  assetId: string;
  serviceStatus: ServiceStatus;
  workerNamesById: WorkerNamesById;
  onClose: () => void;
}

export function ServiceStatusForm({
  assetId,
  serviceStatus,
  workerNamesById,
  onClose,
}: ServiceStatusFormProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const targetStatus: ServiceStatus =
    serviceStatus === 'in_service' ? 'out_of_service' : 'in_service';
  const [reason, setReason] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(() => siteWallClockNow());
  const [reasonError, setReasonError] = useState<string | null>(null);
  const submission = useLedgerSubmission<ChangeServiceStatusRequest, ServiceStatusChangeResult>(
    `service-status-${assetId}`,
    (request, idempotencyKey) => changeServiceStatus(assetId, request, idempotencyKey),
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setReasonError('Say why, in a few words.');
      return;
    }
    setReasonError(null);
    if (!selectedKeeper) {
      return;
    }
    const effectiveAtIso = isoFromSiteWallClock(effectiveAt);
    if (effectiveAtIso === null) {
      return;
    }
    const succeeded = await submission.submit({
      status: targetStatus,
      keeperId: selectedKeeper.keeperId,
      reason: reason.trim(),
      effectiveAt: effectiveAtIso,
    });
    if (succeeded) {
      setReason('');
      setEffectiveAt(siteWallClockNow());
    }
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <NoteField
        label="Reason"
        optional={false}
        value={reason}
        onChange={setReason}
        error={reasonError}
        hint={
          targetStatus === 'out_of_service'
            ? 'Recorded on the ledger. Standing reservations on this asset are voided.'
            : 'Recorded on the ledger with the return to service.'
        }
      />
      <DatetimeField
        label="Effective at"
        value={effectiveAt}
        onChange={setEffectiveAt}
        hint="Backdate if it happened earlier; the time it was written down is recorded automatically."
      />
      <SubmitBar
        label={targetStatus === 'out_of_service' ? 'Take out of service' : 'Return to service'}
        submitting={submission.submitting}
        ready={submission.ready}
        keeperChosen={selectedKeeper !== null}
        onCancel={onClose}
      />
      <SubmissionFeedback
        state={submission.state}
        renderSuccess={(result) => (
          <Notice tone="success" title="Recorded">
            <dl className={formStyles.summary}>
              <div>
                <dt>Times</dt>
                <dd>
                  <TimestampPair
                    effectiveAt={result.movement.effectiveAt}
                    recordedAt={result.movement.recordedAt}
                  />
                </dd>
              </div>
              <div>
                <dt>Asset now</dt>
                <dd>
                  <AssetStatusBadge status={result.asset.status} />
                </dd>
              </div>
              <div>
                <dt>Voided reservations</dt>
                <dd>
                  <VoidedReservationsList
                    reservations={result.voidedReservations}
                    workerNamesById={workerNamesById}
                  />
                </dd>
              </div>
            </dl>
          </Notice>
        )}
      />
    </form>
  );
}
