import { expect, test } from '@playwright/test';
import { utcDateWithOffset } from './helpers';

test('as-of view two days ago at 14:20 UTC shows GAS-001 held by Daniel Okafor', async ({ page }) => {
  const instant = `${utcDateWithOffset(-2)}T14:20:00Z`;
  await page.goto(`/as-of?at=${encodeURIComponent(instant)}`);

  await expect(page.getByText(instant.replace('Z', '.000Z'))).toBeVisible();
  const row = page.getByRole('row', { name: /GAS-001/ });
  await expect(row).toContainText('Issued');
  await expect(row).toContainText('Daniel Okafor');
});
