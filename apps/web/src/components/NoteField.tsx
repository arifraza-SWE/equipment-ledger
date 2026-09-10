import type { ReactNode } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

interface NoteFieldProps {
  label?: string;
  value: string;
  onChange: (note: string) => void;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

export function NoteField({
  label = 'Note',
  value,
  onChange,
  hint,
  error,
  optional = true,
}: NoteFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <textarea
          id={control.id}
          className={styles.control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
        />
      )}
    </Field>
  );
}
