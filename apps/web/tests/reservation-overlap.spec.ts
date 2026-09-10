import { expect, test } from '@playwright/test';
import { chooseKeeper, toSiteWallClock, utcDateWithOffset } from './helpers';

test('a reservation overlapping the seeded TWR-001 window is refused with the overlap message', async ({
  page,
}) => {
  const day = utcDateWithOffset(2);
  await page.goto('/reservations');
  await chooseKeeper(page);

  await page.getByLabel('Asset', { exact: true }).selectOption('TWR-001');
  await page.getByLabel('Worker', { exact: true }).selectOption('WKR-001');
  await page.getByLabel('Starts', { exact: true }).fill(toSiteWallClock(new Date(`${day}T09:00:00Z`)));
  await page.getByLabel('Ends', { exact: true }).fill(toSiteWallClock(new Date(`${day}T11:00:00Z`)));

  await page.getByRole('button', { name: 'Reserve' }).click();

  const refusal = page.getByRole('status').filter({ hasText: 'The store refused this' });
  await expect(refusal).toContainText('TWR-001 is already reserved by Priya Raman');
  await expect(refusal).toContainText('Reservations on one asset cannot overlap');
});
