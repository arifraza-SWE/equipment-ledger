import { Button } from './Button';
import styles from './Form.module.css';

interface SubmitBarProps {
  label: string;
  submitting: boolean;
  ready: boolean;
  keeperChosen: boolean;
  onCancel?: () => void;
}

export function SubmitBar({ label, submitting, ready, keeperChosen, onCancel }: SubmitBarProps) {
  return (
    <div className={styles.actions}>
      <Button type="submit" disabled={!ready || !keeperChosen || submitting}>
        {submitting ? 'Recording…' : label}
      </Button>
      {onCancel && (
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Close
        </Button>
      )}
      {!keeperChosen && (
        <span className={styles.actionsNote}>Choose a keeper in the header first.</span>
      )}
    </div>
  );
}
