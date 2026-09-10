import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { ApiUnreachableBanner } from '@/components/ApiUnreachableBanner';
import { AppHeader } from '@/components/AppHeader';
import { KeeperProvider } from '@/components/KeeperProvider';
import shellStyles from '@/components/AppShell.module.css';
import { fetchKeepers } from '@/features/workers/api/keepers-api';
import { attemptRequest } from '@/lib/api-client';
import { fetchApiHealth } from '@/lib/api-health';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Equipment ledger', template: '%s · Equipment ledger' },
  description: 'Tool store ledger: issues, returns, reservations and the store as of any instant.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [health, keepers] = await Promise.all([
    attemptRequest(fetchApiHealth),
    attemptRequest(fetchKeepers),
  ]);
  const bannerMessage = !health.ok
    ? health.message
    : health.value.status === 'degraded'
      ? 'The API is up but its database is disconnected; nothing can be read or written until it reconnects.'
      : null;

  return (
    <html lang="en-GB" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <KeeperProvider keepers={keepers.ok ? keepers.value : []}>
          <AppHeader />
          {bannerMessage && <ApiUnreachableBanner message={bannerMessage} />}
          <main className={shellStyles.main}>{children}</main>
        </KeeperProvider>
      </body>
    </html>
  );
}
