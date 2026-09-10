'use client';

import type {
  AssetSnapshot,
  CreateReservationRequest,
  Reservation,
  Worker,
} from '@equipment-ledger/shared';
import { useState, type FormEvent } from 'react';
import { DatetimeField } from '@/components/DatetimeField';
import { useSelectedKeeper } from '@/components/KeeperProvider';
import { NoteField } from '@/components/NoteField';
import { Notice } from '@/components/Notice';
import { SubmissionFeedback } from '@/components/SubmissionFeedback';
import { SubmitBar } from '@/components/SubmitBar';
import formStyles from '@/components/Form.module.css';
import { AssetField, describeAssetOption } from '@/features/assets/components/AssetField';
import { WorkerField } from '@/features/workers/components/WorkerField';
import { useLedgerSubmission } from '@/hooks/use-ledger-submission';
import { isoFromSiteWallClock } from '@/lib/site-time';
import { createReservation } from '../api/reservations-api';
import { RESERVATION_STANDING_LABELS } from '../reservation-standing';
import { ReservationWindow } from './ReservationWindow';

interface ReservationFormProps {
  assets: AssetSnapshot[];
  workers: Worker[];
}

interface ReservationFormValues {
  assetId: string;
  workerId: string;
  startsAt: string;
  endsAt: string;
  note: string;
}

type FieldErrors = Partial<Record<keyof ReservationFormValues, string>>;

const EMPTY_VALUES: ReservationFormValues = {
  assetId: '',
  workerId: '',
  startsAt: '',
  endsAt: '',
  note: '',
};

const PAST_TOLERANCE_MILLIS = 2 * 60 * 1000;

export function ReservationForm({ assets, workers }: ReservationFormProps) {
  const { selectedKeeper } = useSelectedKeeper();
  const [values, setValues] = useState<ReservationFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submission = useLedgerSubmission<CreateReservationRequest, Reservation>(
    'create-reservation',
    createReservation,
  );

  const chosenAsset = assets.find((snapshot) => snapshot.asset.assetId === values.assetId);
  const startsAtIso = isoFromSiteWallClock(values.startsAt);
  const endsAtIso = isoFromSiteWallClock(values.endsAt);

  const update = <TKey extends keyof ReservationFormValues>(
    key: TKey,
    nextValue: ReservationFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: nextValue }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = findProblems(values, startsAtIso, endsAtIso);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0 || !selectedKeeper || !startsAtIso || !endsAtIso) {
      return;
    }
    const succeeded = await submission.submit({
      assetId: values.assetId,
      workerId: values.workerId,
      keeperId: selectedKeeper.keeperId,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      note: values.note.trim() || null,
    });
    if (succeeded) {
      setValues(EMPTY_VALUES);
    }
  };

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <AssetField
        label="Asset"
        assets={assets}
        value={values.assetId}
        onChange={(assetId) => update('assetId', assetId)}
        describeOption={describeReservableAsset}
        error={fieldErrors.assetId}
      />
      <WorkerField
        label="Worker"
        workers={workers}
        value={values.workerId}
        onChange={(workerId) => update('workerId', workerId)}
        requiredCertification={chosenAsset?.asset.requiredCertification ?? null}
        atIso={startsAtIso}
        error={fieldErrors.workerId}
        hint="The certificate must cover the start of the reservation."
      />
      <DatetimeField
        label="Starts"
        value={values.startsAt}
        onChange={(startsAt) => update('startsAt', startsAt)}
        error={fieldErrors.startsAt}
      />
      <DatetimeField
        label="Ends"
        value={values.endsAt}
        onChange={(endsAt) => update('endsAt', endsAt)}
        error={fieldErrors.endsAt}
        hint="At least 15 minutes, at most 14 days. Windows on one asset may touch but not overlap."
      />
      <NoteField value={values.note} onChange={(note) => update('note', note)} />
      <SubmitBar
        label="Reserve"
        submitting={submission.submitting}
        ready={submission.ready}
        keeperChosen={selectedKeeper !== null}
      />
      <SubmissionFeedback
        state={submission.state}
        renderSuccess={(reservation, replayed) => (
          <Notice tone="success" title={`Reserved · ${reservation.assetId}`}>
            <p>
              <ReservationWindow reservation={reservation} />
              {reservation.standing && (
                <span className="muted"> · {RESERVATION_STANDING_LABELS[reservation.standing]}</span>
              )}
            </p>
            {replayed && <p>This reservation was made on an earlier attempt; it exists once.</p>}
          </Notice>
        )}
      />
    </form>
  );
}

function describeReservableAsset(snapshot: AssetSnapshot): string {
  const base = describeAssetOption(snapshot);
  return snapshot.serviceStatus === 'out_of_service' ? `${base} · out of service` : base;
}

function findProblems(
  values: ReservationFormValues,
  startsAtIso: string | null,
  endsAtIso: string | null,
): FieldErrors {
  const problems: FieldErrors = {};
  if (!values.assetId) {
    problems.assetId = 'Choose an asset.';
  }
  if (!values.workerId) {
    problems.workerId = 'Choose a worker.';
  }
  if (startsAtIso === null) {
    problems.startsAt = 'Enter when it starts.';
  } else if (new Date(startsAtIso).getTime() < Date.now() - PAST_TOLERANCE_MILLIS) {
    problems.startsAt = 'A reservation is for the future. Equipment already out should be issued.';
  }
  if (endsAtIso === null) {
    problems.endsAt = 'Enter when it ends.';
  } else if (startsAtIso !== null && endsAtIso <= startsAtIso) {
    problems.endsAt = 'Must end after it starts.';
  }
  return problems;
}
