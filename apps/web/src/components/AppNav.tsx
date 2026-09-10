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

interface AppNavProps {
  open: boolean;
  onNavigate: () => void;
}

export function AppNav({ open, onNavigate }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav
      id="main-navigation"
      aria-label="Main"
      className={styles.nav}
      data-open={open ? 'true' : 'false'}
    >
      {NAV_ITEMS.map((navItem) => {
        const active = navItem.href === '/' ? pathname === '/' : pathname.startsWith(navItem.href);
        return (
          <Link
            key={navItem.href}
            href={navItem.href}
            className={styles.navLink}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {navItem.label}
          </Link>
        );
      })}
    </nav>
  );
}
