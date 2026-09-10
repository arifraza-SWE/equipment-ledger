import {
  CERTIFICATION_LABELS,
  type CertificationType,
  type Worker,
} from '@equipment-ledger/shared';
import { Field } from '@/components/Field';
import { formatDay } from '@/lib/site-time';
import formStyles from '@/components/Form.module.css';
import { certificationStanding, isCertificationExpired } from '../domain/certification-standing';
import styles from './WorkerField.module.css';

interface WorkerFieldProps {
  label: string;
  workers: Worker[];
  value: string;
  onChange: (workerId: string) => void;
  requiredCertification: CertificationType | null;
  atIso: string | null;
  error?: string | null;
  hint?: string;
}

export function WorkerField({
  label,
  workers,
  value,
  onChange,
  requiredCertification,
  atIso,
  error,
  hint,
}: WorkerFieldProps) {
  const chosenWorker = workers.find((worker) => worker.workerId === value) ?? null;

  return (
    <Field
      label={label}
      error={error}
      hint={
        chosenWorker ? (
          <WorkerCertificationSummary
            worker={chosenWorker}
            requiredCertification={requiredCertification}
            atIso={atIso}
          />
        ) : (
          hint
        )
      }
    >
      {(control) => (
        <select
          id={control.id}
          className={formStyles.control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
        >
          <option value="">Choose worker</option>
          {workers.map((worker) => (
            <option key={worker.workerId} value={worker.workerId}>
              {describeWorkerOption(worker, requiredCertification, atIso)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function describeWorkerOption(
  worker: Worker,
  requiredCertification: CertificationType | null,
  atIso: string | null,
): string {
  const base = `${worker.fullName} (${worker.workerId}) · ${worker.trade}`;
  const standing = certificationStanding(worker, requiredCertification, atIso);
  switch (standing.kind) {
    case 'missing':
      return `${base} · no certificate`;
    case 'expired':
      return `${base} · certificate expired`;
    case 'not_yet_valid':
      return `${base} · certificate not yet valid`;
    default:
      return base;
  }
}

function WorkerCertificationSummary({
  worker,
  requiredCertification,
  atIso,
}: {
  worker: Worker;
  requiredCertification: CertificationType | null;
  atIso: string | null;
}) {
  const standing = certificationStanding(worker, requiredCertification, atIso);
  const requiredLabel = requiredCertification ? CERTIFICATION_LABELS[requiredCertification] : null;

  return (
    <span className={styles.summary}>
      {worker.certifications.length === 0 ? (
        <span>Holds no certificates.</span>
      ) : (
        <span>
          {worker.certifications.map((certification) => (
            <span
              key={certification.type}
              className={styles.certificate}
              data-expired={isCertificationExpired(certification.expiresAt, atIso)}
            >
              {CERTIFICATION_LABELS[certification.type]}{' '}
              {isCertificationExpired(certification.expiresAt, atIso) ? 'expired' : 'until'}{' '}
              {formatDay(certification.expiresAt)}
            </span>
          ))}
        </span>
      )}
      {requiredLabel && standing.kind !== 'valid' && standing.kind !== 'not_required' && (
        <span className={styles.warning}>
          {describeShortfall(standing, requiredLabel)} The store decides; it will refuse this.
        </span>
      )}
    </span>
  );
}

function describeShortfall(
  standing: Exclude<
    ReturnType<typeof certificationStanding>,
    { kind: 'valid' } | { kind: 'not_required' }
  >,
  requiredLabel: string,
): string {
  switch (standing.kind) {
    case 'missing':
      return `No ${requiredLabel} certificate.`;
    case 'expired':
      return `${requiredLabel} certificate expired on ${formatDay(standing.expiredAt)}.`;
    case 'not_yet_valid':
      return `${requiredLabel} certificate is not valid until ${formatDay(standing.validFrom)}.`;
  }
}
