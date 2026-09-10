'use client';

import type {
  AssetSnapshot,
  MovementResult,
  ReturnAssetRequest,
  Worker,
} from '@equipment-ledger/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DatetimeField } from '@/components/DatetimeField';
import { CheckboxField } from '@/components/Field';
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
import { isoFromSiteWallClock, siteWallClockNow } from '@/lib/site-time';
import { returnAsset } from '../api/movements-api';
import { MovementResultSummary } from './MovementResultSummary';
import {
  describeHeldAsset,
  EMPTY_RETURN_VALUES,
  findReturnProblems,
  type ReturnFieldErrors,
  type ReturnFormValues,
} from './return-form-values';

interface ReturnAssetFormProps {
  assets: AssetSnapshot[];
  workers: Worker[];
  initialAssetId: string | null;
}

export function ReturnAssetForm({ assets, workers, initialAssetId }: ReturnAssetFormProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const heldAssets = useMemo(
    () => assets.filter((snapshot) => snapshot.holding !== null),
    [assets],
  );
  const workerNamesById = useMemo(() => indexWorkerNames(workers), [workers]);
  const requestedButNotHeld = assets.find(
    (snapshot) => snapshot.asset.assetId === initialAssetId && snapshot.holding === null,
  );

  const [values, setValues] = useState<ReturnFormValues>(() => {
    const initialAsset = heldAssets.find((snapshot) => snapshot.asset.assetId === initialAssetId);
    return {
      ...EMPTY_RETURN_VALUES,
      assetId: initialAsset?.asset.assetId ?? '',
      returnedByWorkerId: initialAsset?.holding?.worker.workerId ?? '',
    };
  });
  const [fieldErrors, setFieldErrors] = useState<ReturnFieldErrors>({});
  const submission = useLedgerSubmission<ReturnAssetRequest, MovementResult>(
    'return-asset',
    returnAsset,
  );

  useEffect(() => {
    setValues((current) => ({ ...current, effectiveAt: siteWallClockNow() }));
  }, []);

  const chosenAsset = heldAssets.find((snapshot) => snapshot.asset.assetId === values.assetId);
  const holder = chosenAsset?.holding?.worker ?? null;
  const differentReturner = holder !== null && values.returnedByWorkerId !== holder.workerId;
  const effectiveAtIso = isoFromSiteWallClock(values.effectiveAt);

  const update = <TKey extends keyof ReturnFormValues>(
    key: TKey,
    nextValue: ReturnFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: nextValue }));

  const chooseAsset = (assetId: string) => {
    const snapshot = heldAssets.find((candidate) => candidate.asset.assetId === assetId);
    setValues((current) => ({
      ...current,
      assetId,
      returnedByWorkerId: snapshot?.holding?.worker.workerId ?? '',
      acknowledgeDifferentReturner: false,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = findReturnProblems(values, effectiveAtIso);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0 || !selectedKeeper || effectiveAtIso === null) {
      return;
    }
    const succeeded = await submission.submit({
      assetId: values.assetId,
      returnedByWorkerId: values.returnedByWorkerId,
      keeperId: selectedKeeper.keeperId,
      effectiveAt: effectiveAtIso,
      acknowledgeDifferentReturner: values.acknowledgeDifferentReturner,
      takeOutOfService: values.takeOutOfService,
      note: values.note.trim() || null,
    });
    if (succeeded) {
      setValues({ ...EMPTY_RETURN_VALUES, effectiveAt: siteWallClockNow() });
    }
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      {requestedButNotHeld && (
        <Notice tone="info">
          {requestedButNotHeld.asset.assetId} is not out with anyone, so there is nothing to return.
        </Notice>
      )}
      <AssetField
        label="Asset"
        assets={heldAssets}
        value={values.assetId}
        onChange={chooseAsset}
        describeOption={describeHeldAsset}
        error={fieldErrors.assetId}
        hint="Only assets currently out are listed."
      />
      <WorkerField
        label="Returned by"
        workers={workers}
        value={values.returnedByWorkerId}
        onChange={(workerId) => update('returnedByWorkerId', workerId)}
        requiredCertification={null}
        atIso={effectiveAtIso}
        error={fieldErrors.returnedByWorkerId}
        hint={
          holder ? `Held by ${holder.fullName}.` : 'Defaults to the holder once an asset is chosen.'
        }
      />
      <DatetimeField
        label="Came back at"
        value={values.effectiveAt}
        onChange={(effectiveAt) => update('effectiveAt', effectiveAt)}
        error={fieldErrors.effectiveAt}
        hint="Backdate if it happened earlier; the time it was written down is recorded automatically."
      />
      <CheckboxField
        label="Returned by a different worker than the holder"
        checked={values.acknowledgeDifferentReturner}
        onChange={(checked) => update('acknowledgeDifferentReturner', checked)}
        hint={
          differentReturner
            ? `${workerNamesById[values.returnedByWorkerId] ?? values.returnedByWorkerId} is not the holder; the store refuses unless this is ticked.`
            : 'Only needed when someone hands it back on the holder’s behalf.'
        }
      />
      <CheckboxField
        label="Damaged: take out of service"
        checked={values.takeOutOfService}
        onChange={(checked) => update('takeOutOfService', checked)}
        hint="The note below is recorded as the reason. Standing reservations on the asset are voided."
      />
      <NoteField
        label={values.takeOutOfService ? 'Reason' : 'Note'}
        optional={!values.takeOutOfService}
        value={values.note}
        onChange={(note) => update('note', note)}
        error={fieldErrors.note}
      />
      <SubmitBar
        label="Record return"
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
