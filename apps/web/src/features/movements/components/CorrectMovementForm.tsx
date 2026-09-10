'use client';

import type {
  CorrectionKind,
  CorrectionResult,
  CorrectMovementRequest,
  Movement,
  Worker,
} from '@equipment-ledger/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { useSelectedKeeper } from '@/components/KeeperProvider';
import { NoteField } from '@/components/NoteField';
import { SubmissionFeedback } from '@/components/SubmissionFeedback';
import { SubmitBar } from '@/components/SubmitBar';
import formStyles from '@/components/Form.module.css';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { useLedgerSubmission } from '@/hooks/use-ledger-submission';
import { siteWallClockFromIso } from '@/lib/site-time';
import { correctMovement } from '../api/movements-api';
import { buildCorrectionRequest, type CorrectionFormValues } from '../build-correction-request';
import { AmendmentFields } from './AmendmentFields';
import { CorrectionResultSummary } from './CorrectionResultSummary';

interface CorrectMovementFormProps {
  movement: Movement;
  workers: Worker[];
  onClose: () => void;
}

export function CorrectMovementForm({ movement, workers, onClose }: CorrectMovementFormProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const workerNamesById = useMemo(() => indexWorkerNames(workers), [workers]);
  const [values, setValues] = useState<CorrectionFormValues>(() => ({
    kind: 'amend',
    reason: '',
    effectiveAt: siteWallClockFromIso(movement.effectiveAt),
    workerId: movement.workerId ?? '',
    returnedByWorkerId: movement.returnedByWorkerId ?? '',
    dueAt: siteWallClockFromIso(movement.dueAt),
    note: movement.note ?? '',
  }));
  const [reasonError, setReasonError] = useState<string | null>(null);
  const submission = useLedgerSubmission<CorrectMovementRequest, CorrectionResult>(
    `correct-movement-${movement.movementId}`,
    (request, idempotencyKey) => correctMovement(movement.movementId, request, idempotencyKey),
  );

  const update = <TKey extends keyof CorrectionFormValues>(
    key: TKey,
    nextValue: CorrectionFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: nextValue }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (values.reason.trim().length < 3) {
      setReasonError('Say why this entry is wrong.');
      return;
    }
    setReasonError(null);
    if (!selectedKeeper) {
      return;
    }
    await submission.submit(buildCorrectionRequest(movement, values, selectedKeeper.keeperId));
  };

  const succeeded = submission.state.phase === 'succeeded';

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      {!succeeded && (
        <>
          <fieldset className={formStyles.fieldset}>
            <legend className={formStyles.legend}>Correction</legend>
            <div className={formStyles.radioRow}>
              {KIND_OPTIONS.map((option) => (
                <label key={option.kind} className={formStyles.radio}>
                  <input
                    type="radio"
                    name={`correction-kind-${movement.movementId}`}
                    value={option.kind}
                    checked={values.kind === option.kind}
                    onChange={() => update('kind', option.kind)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <NoteField
            label="Reason"
            optional={false}
            value={values.reason}
            onChange={(reason) => update('reason', reason)}
            error={reasonError}
            hint="Kept with the correction, alongside who made it and when."
          />
          {values.kind === 'amend' && (
            <AmendmentFields original={movement} workers={workers} values={values} onChange={update} />
          )}
        </>
      )}
      <SubmitBar
        label={values.kind === 'void' ? 'Void this entry' : 'Record correction'}
        submitting={submission.submitting}
        ready={submission.ready && !succeeded}
        keeperChosen={selectedKeeper !== null}
        onCancel={onClose}
      />
      <SubmissionFeedback
        state={submission.state}
        renderSuccess={(result, replayed) => (
          <CorrectionResultSummary
            result={result}
            replayed={replayed}
            workerNamesById={workerNamesById}
          />
        )}
      />
    </form>
  );
}

const KIND_OPTIONS: ReadonlyArray<{ kind: CorrectionKind; label: string }> = [
  { kind: 'amend', label: 'Amend: replace with corrected details' },
  { kind: 'void', label: 'Void: it never happened' },
];
