'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppNav } from './AppNav';
import { CloseIcon, MenuIcon, PackageIcon } from './Icon';
import { KeeperSelect } from './KeeperSelect';
import styles from './AppShell.module.css';

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <PackageIcon size={17} />
          </span>
          <span className={styles.brandText}>
            <Link href="/" className={styles.brandName}>
              Equipment ledger
            </Link>
            <span className={styles.brandSite}>Site store</span>
          </span>
        </div>

        <AppNav open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        <KeeperSelect />

        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>
    </header>
  );
}
