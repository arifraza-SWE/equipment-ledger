'use client';

import { apiBaseUrl } from '@/lib/api-base-url';
import { useSelectedKeeper } from './KeeperProvider';
import styles from './AppShell.module.css';

export function AppFooter() {
  const { selectedKeeper } = useSelectedKeeper();

  return (
    <footer className={styles.footer}>
      <span>
        API <span className="mono">{apiBaseUrl}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {selectedKeeper
          ? `Keeper ${selectedKeeper.fullName} (${selectedKeeper.keeperId})`
          : 'No keeper chosen'}
      </span>
    </footer>
  );
}
