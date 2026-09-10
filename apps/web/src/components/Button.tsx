import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  quiet: styles.quiet,
};

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.button, VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
