import type { Movement, Worker } from '@equipment-ledger/shared';
import { DatetimeField } from '@/components/DatetimeField';
import { NoteField } from '@/components/NoteField';
import { WorkerField } from '@/features/workers/components/WorkerField';
import { isoFromSiteWallClock } from '@/lib/site-time';
import type { CorrectionFormValues } from '../build-correction-request';

interface AmendmentFieldsProps {
  original: Movement;
  workers: Worker[];
  values: CorrectionFormValues;
  onChange: <TKey extends keyof CorrectionFormValues>(
    key: TKey,
    nextValue: CorrectionFormValues[TKey],
  ) => void;
}

export function AmendmentFields({ original, workers, values, onChange }: AmendmentFieldsProps) {
  return (
    <>
      <DatetimeField
        label="Effective at"
        value={values.effectiveAt}
        onChange={(effectiveAt) => onChange('effectiveAt', effectiveAt)}
        hint="When it really happened. The original entry stays on the ledger, struck through."
      />
      {original.type === 'issue' && (
        <>
          <WorkerField
            label="Worker"
            workers={workers}
            value={values.workerId}
            onChange={(workerId) => onChange('workerId', workerId)}
            requiredCertification={null}
            atIso={isoFromSiteWallClock(values.effectiveAt)}
          />
          <DatetimeField
            label="Due back"
            optional
            value={values.dueAt}
            onChange={(dueAt) => onChange('dueAt', dueAt)}
            hint="Clear it to remove the due time."
          />
        </>
      )}
      {original.type === 'return' && (
        <WorkerField
          label="Returned by"
          workers={workers}
          value={values.returnedByWorkerId}
          onChange={(returnedByWorkerId) => onChange('returnedByWorkerId', returnedByWorkerId)}
          requiredCertification={null}
          atIso={null}
        />
      )}
      <NoteField value={values.note} onChange={(note) => onChange('note', note)} />
    </>
  );
}
