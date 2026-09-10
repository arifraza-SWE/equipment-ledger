'use client';

import type {
  AssetSnapshot,
  IssueAssetRequest,
  MovementResult,
  Reservation,
  Worker,
} from '@equipment-ledger/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DatetimeField } from '@/components/DatetimeField';
import { useSelectedKeeper } from '@/components/KeeperProvider';
import { NoteField } from '@/components/NoteField';
import { Notice } from '@/components/Notice';
import { SubmissionFeedback } from '@/components/SubmissionFeedback';
import { SubmitBar } from '@/components/SubmitBar';
import formStyles from '@/components/Form.module.css';
import { AssetField } from '@/features/assets/components/AssetField';
import { WorkerField } from '@/features/workers/components/WorkerField';
import { indexWorkerNames } from '@/features/workers/worker-names';
import { useLedgerSubmission } from '@/hooks/use-ledger-submission';
import { isoFromDatetimeLocal, toDatetimeLocalValue } from '@/lib/datetime-local';
import { issueAsset } from '../api/movements-api';
import { MovementResultSummary } from './MovementResultSummary';
import { ReservationLinkField } from './ReservationLinkField';

interface IssueAssetFormProps {
  assets: AssetSnapshot[];
  workers: Worker[];
  activeReservations: Reservation[];
  initialAssetId: string | null;
}

interface IssueFormValues {
  assetId: string;
  workerId: string;
  effectiveAt: string;
  dueAt: string;
  reservationId: string;
  note: string;
}

type FieldErrors = Partial<Record<keyof IssueFormValues, string>>;

const EMPTY_VALUES: IssueFormValues = {
  assetId: '',
  workerId: '',
  effectiveAt: '',
  dueAt: '',
  reservationId: '',
  note: '',
};

export function IssueAssetForm({
  assets,
  workers,
  activeReservations,
  initialAssetId,
}: IssueAssetFormProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const issuableAssets = useMemo(() => assets.filter(isIssuable), [assets]);
  const workerNamesById = useMemo(() => indexWorkerNames(workers), [workers]);
  const requestedButUnavailable = assets.find(
    (snapshot) => snapshot.asset.assetId === initialAssetId && !isIssuable(snapshot),
  );

  const [values, setValues] = useState<IssueFormValues>(() => ({
    ...EMPTY_VALUES,
    assetId: issuableAssets.some((snapshot) => snapshot.asset.assetId === initialAssetId)
      ? (initialAssetId ?? '')
      : '',
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submission = useLedgerSubmission<IssueAssetRequest, MovementResult>('issue-asset', issueAsset);

  useEffect(() => {
    setValues((current) => ({ ...current, effectiveAt: toDatetimeLocalValue(new Date()) }));
  }, []);

  const chosenAsset = issuableAssets.find((snapshot) => snapshot.asset.assetId === values.assetId);
  const effectiveAtIso = isoFromDatetimeLocal(values.effectiveAt);
  const workerReservations = activeReservations.filter(
    (reservation) =>
      reservation.assetId === values.assetId && reservation.workerId === values.workerId,
  );

  const update = <TKey extends keyof IssueFormValues>(key: TKey, nextValue: IssueFormValues[TKey]) =>
    setValues((current) => ({ ...current, [key]: nextValue }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = findProblems(values, effectiveAtIso);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0 || !selectedKeeper || effectiveAtIso === null) {
      return;
    }
    const succeeded = await submission.submit({
      assetId: values.assetId,
      workerId: values.workerId,
      keeperId: selectedKeeper.keeperId,
      effectiveAt: effectiveAtIso,
      dueAt: isoFromDatetimeLocal(values.dueAt),
      reservationId: values.reservationId || null,
      note: values.note.trim() || null,
    });
    if (succeeded) {
      setValues({ ...EMPTY_VALUES, effectiveAt: toDatetimeLocalValue(new Date()) });
    }
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      {requestedButUnavailable && (
        <Notice tone="info">{describeUnavailable(requestedButUnavailable)}</Notice>
      )}
      <AssetField
        label="Asset"
        assets={issuableAssets}
        value={values.assetId}
        onChange={(assetId) => update('assetId', assetId)}
        error={fieldErrors.assetId}
        hint="Only assets in store and in service are listed."
      />
      <WorkerField
        label="Worker"
        workers={workers}
        value={values.workerId}
        onChange={(workerId) => update('workerId', workerId)}
        requiredCertification={chosenAsset?.asset.requiredCertification ?? null}
        atIso={effectiveAtIso}
        error={fieldErrors.workerId}
        hint="Certificates are shown once a worker is chosen."
      />
      <DatetimeField
        label="Went out at"
        value={values.effectiveAt}
        onChange={(effectiveAt) => update('effectiveAt', effectiveAt)}
        error={fieldErrors.effectiveAt}
        hint="Backdate if it happened earlier; the time it was written down is recorded automatically."
      />
      <DatetimeField
        label="Due back"
        optional
        value={values.dueAt}
        onChange={(dueAt) => update('dueAt', dueAt)}
        hint="Leave blank and the store sets it: the reservation end, or eight hours after issue."
      />
      {values.assetId && values.workerId && (
        <ReservationLinkField
          reservations={workerReservations}
          value={values.reservationId}
          onChange={(reservationId) => update('reservationId', reservationId)}
        />
      )}
      <NoteField value={values.note} onChange={(note) => update('note', note)} />
      <SubmitBar
        label="Record issue"
        submitting={submission.submitting}
        ready={submission.ready}
        keeperChosen={selectedKeeper !== null}
      />
      <SubmissionFeedback
        state={submission.state}
        renderSuccess={(result, replayed) => (
          <MovementResultSummary
            result={result}
            replayed={replayed}
            workerNamesById={workerNamesById}
          />
        )}
      />
    </form>
  );
}

function isIssuable(snapshot: AssetSnapshot): boolean {
  return snapshot.holding === null && snapshot.serviceStatus === 'in_service';
}

function findProblems(values: IssueFormValues, effectiveAtIso: string | null): FieldErrors {
  const problems: FieldErrors = {};
  if (!values.assetId) {
    problems.assetId = 'Choose an asset.';
  }
  if (!values.workerId) {
    problems.workerId = 'Choose a worker.';
  }
  if (effectiveAtIso === null) {
    problems.effectiveAt = 'Enter when it went out.';
  }
  return problems;
}

function describeUnavailable(snapshot: AssetSnapshot): string {
  if (snapshot.holding) {
    return `${snapshot.asset.assetId} is held by ${snapshot.holding.worker.fullName} and cannot be issued until it comes back.`;
  }
  return `${snapshot.asset.assetId} is out of service and cannot be issued until it is returned to service.`;
}
