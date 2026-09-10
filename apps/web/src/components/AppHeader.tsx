import Link from 'next/link';
import { AppNav } from './AppNav';
import { KeeperSelect } from './KeeperSelect';
import styles from './AppShell.module.css';

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/" className={styles.brandName}>
          Equipment ledger
        </Link>
        <span className={styles.brandSite}>Site store</span>
      </div>
      <AppNav />
      <KeeperSelect />
    </header>
  );
}
