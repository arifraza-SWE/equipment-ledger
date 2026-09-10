import styles from './AppShell.module.css';

export function ApiUnreachableBanner({ message }: { message: string }) {
  return (
    <div className={styles.banner} role="alert">
      <strong>Store API not answering.</strong> {message}
    </div>
  );
}
