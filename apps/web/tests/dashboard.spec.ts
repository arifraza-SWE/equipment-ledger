import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';

test('dashboard lists the seeded assets and flags HARN-003 as overdue', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  await expect(page.getByRole('heading', { name: 'Store ledger' })).toBeVisible();
  await expect(page.getByRole('row', { name: /DRL-003/ })).toBeVisible();

  // The table is paged now, so search for the overdue asset rather than trusting it to sit on
  // the first page: the seed only has to gain one asset for a position to stop being true.
  await page.getByLabel('Search').fill('HARN-003');

  const overdueRow = page.getByRole('row', { name: /HARN-003/ });
  await expect(overdueRow).toContainText('Overdue');
  await expect(overdueRow).toContainText('Callum Reid');
});

test('the ledger pages through the seeded assets and resets when the list narrows', async ({
  page,
}) => {
  await page.goto('/');
  await waitForHydration(page);

  await expect(page.getByText('Showing 1–25 of 60 assets')).toBeVisible();

  await page.getByRole('navigation', { name: 'Pagination' }).getByLabel('Page 3').click();
  await expect(page.getByText('Showing 51–60 of 60 assets')).toBeVisible();

  // Narrowing the list has to put the reader back on the first page; page three of the old list
  // means nothing in the new one.
  await page.getByLabel('Search').fill('GAS');
  await expect(page.getByText('Showing 1–6 of 6 assets')).toBeVisible();
});
