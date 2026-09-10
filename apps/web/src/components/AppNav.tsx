'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Ledger' },
  { href: '/issue', label: 'Issue' },
  { href: '/return', label: 'Return' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/movements', label: 'Movements' },
  { href: '/as-of', label: 'As of' },
  { href: '/workers', label: 'Workers' },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={styles.nav}>
      {NAV_ITEMS.map((navItem) => {
        const active = navItem.href === '/' ? pathname === '/' : pathname.startsWith(navItem.href);
        return (
          <Link
            key={navItem.href}
            href={navItem.href}
            className={styles.navLink}
            aria-current={active ? 'page' : undefined}
          >
            {navItem.label}
          </Link>
        );
      })}
    </nav>
  );
}
