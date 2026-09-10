import type { ReactNode } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

interface DatetimeFieldProps {
  label: string;
  value: string;
  onChange: (inputValue: string) => void;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

export function DatetimeField({ label, value, onChange, hint, error, optional }: DatetimeFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <input
          id={control.id}
          type="datetime-local"
          className={styles.control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
        />
      )}
    </Field>
  );
}
