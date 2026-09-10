import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './Form.module.css';

interface ControlBindings {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (control: ControlBindings) => ReactNode;
}

export function Field({ label, hint, error, optional, children }: FieldProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> optional</span>}
      </label>
      {children({ id: controlId, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ label, hint, checked, onChange }: CheckboxFieldProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;

  return (
    <div className={styles.checkboxField}>
      <input
        id={controlId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={hint ? hintId : undefined}
      />
      <div>
        <label htmlFor={controlId} className={styles.checkboxLabel}>
          {label}
        </label>
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
