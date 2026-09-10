import { expect, test } from '@playwright/test';

test('dashboard lists the seeded assets and flags HARN-003 as overdue', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Store ledger' })).toBeVisible();
  await expect(page.getByRole('row', { name: /DRL-003/ })).toBeVisible();

  const overdueRow = page.getByRole('row', { name: /HARN-003/ });
  await expect(overdueRow).toContainText('Overdue');
  await expect(overdueRow).toContainText('Callum Reid');
});
