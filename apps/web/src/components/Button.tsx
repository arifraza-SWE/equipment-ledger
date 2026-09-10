import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '@/lib/class-names';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS = {
  primary: styles.primary,
  secondary: styles.secondary,
  quiet: styles.quiet,
} satisfies Record<ButtonVariant, string | undefined>;

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(styles.button, VARIANT_CLASS[variant], className)}
      {...rest}
    />
  );
}
