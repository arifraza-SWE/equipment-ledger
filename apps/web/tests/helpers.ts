import type { Page } from '@playwright/test';

/**
 * The app shows and reads times on the site's clock, never the browser's. The suite runs the
 * browser in a deliberately different timezone (see playwright.config.ts), so anything that
 * slipped back to browser-local time would fail here.
 */
export const SITE_TIMEZONE = process.env.NEXT_PUBLIC_SITE_TIMEZONE ?? 'UTC';

/**
 * A page is server-rendered first and only becomes interactive once React has hydrated. While
 * that swap is happening the server's tree and the client's are briefly in the document at the
 * same time, which makes every locator ambiguous and every test a coin toss. Waiting for the
 * labels to be unique again is waiting for exactly that to finish, and it is per document, so it
 * stays correct with two tabs open at once.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const labels = Array.from(document.querySelectorAll('label')).map(
        (label) => label.textContent ?? '',
      );
      const settled = new Set(labels).size === labels.length;
      const root = document.querySelector('form') ?? document.body;
      const attached = Object.keys(root).some((property) => property.startsWith('__react'));
      return settled && attached;
    },
    null,
    { timeout: 15_000 },
  );
}

export async function chooseKeeper(page: Page, keeperId = 'KPR-01'): Promise<void> {
  await page.getByLabel('Keeper', { exact: true }).selectOption(keeperId);
}

export function utcDateWithOffset(dayOffset: number): string {
  const today = new Date();
  const anchor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return new Date(anchor + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function toSiteWallClock(instant: Date): string {
  const parts = new Map(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: SITE_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const hour = String(Number(parts.get('hour')) % 24).padStart(2, '0');
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${hour}:${parts.get('minute')}`;
}
